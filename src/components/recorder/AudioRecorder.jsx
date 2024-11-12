// import { useEffect, useRef, useState } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import {
//   clearAudioSrc,
//   uploadRequest,
//   setNotePlaying,
//   setAudioErrorOccurred,
// } from "@store/ai/aiConsultSlice";
// import PropTypes from "prop-types";
// // Import MUI components and icons
// import { makeStyles } from "@mui/styles";
// import GraphicEqIcon from "@mui/icons-material/GraphicEq";
// import MicOffIcon from "@mui/icons-material/MicOff";
// import Box from "@mui/material/Box";
// import Typography from "@mui/material/Typography";
// const useStyles = makeStyles({
//   icon: {
//     //fontSize: 70,
//     transition: "transform 0.1s",
//   },
//   animate: {
//     animation: "$pulse 1s infinite",
//     transformOrigin: "center center",
//     willChange: "transform",
//   },
//   "@keyframes pulse": {
//     "0%": {
//       transform: "scale(1)",
//     },
//     "50%": {
//       transform: "scale(1.2)",
//     },
//     "100%": {
//       transform: "scale(1)",
//     },
//   },
// });
// const AudioRecorder = ({
//   uname,
//   phoneNumber,
//   selectedAvatar,
//   onRecordingStart,
//   onRecordingStop,
//   isRecordingAllowed,
// }) => {
//   const classes = useStyles();
//   const dispatch = useDispatch();
//   const current = useSelector((state) => state.aiConsult.audio.current);
//   const audioContextRef = useRef(null);
//   const mediaRecorderRef = useRef(null);
//   const chunksRef = useRef([]);
//   const isRecordingRef = useRef(false);
//   const animationIdRef = useRef(null);
//   const voiceStartTimerRef = useRef(null);
//   const voiceStopTimerRef = useRef(null);
//   const VOICE_START_DEBOUNCE = 50;
//   const VOICE_STOP_DEBOUNCE = 1700;
//   const isUploadingRef = useRef(false);
//   const [volume, setVolume] = useState(0);
//   const [error, setError] = useState(null);
//   const [isRecording, setIsRecording] = useState(false);
//   const getRecordingStatusMessage = () => {
//     if (!isRecordingAllowed) return "";
//     return "상담사에게 말씀해주세요";
//   };
//   useEffect(() => {
//     let isComponentMounted = true;
//     let analyser = null;
//     let dataArray = null;
//     let stream = null;
//     const initializeMedia = () => {
//       if (!isComponentMounted) return;
//       if (!window.AudioContext && !window.webkitAudioContext) {
//         console.error("This browser does not support Web Audio API.");
//         setError("Your browser does not support Web Audio API.");
//         return;
//       }
//       navigator.mediaDevices
//         .getUserMedia({ audio: true })
//         .then((mediaStream) => {
//           if (!isComponentMounted) return;
//           stream = mediaStream;
//           stream.getTracks().forEach((track) => {
//             track.onended = () => {
//               console.log("Microphone input device changed or disconnected");
//               // 에러 상태를 Redux에 업데이트
//               dispatch(setAudioErrorOccurred());
//             };
//           });
//           audioContextRef.current = new (window.AudioContext ||
//             window.webkitAudioContext)();
//           const sourceNode =
//             audioContextRef.current.createMediaStreamSource(stream);
//           analyser = audioContextRef.current.createAnalyser();
//           analyser.fftSize = 512;
//           sourceNode.connect(analyser);
//           dataArray = new Uint8Array(analyser.fftSize);
//           mediaRecorderRef.current = new MediaRecorder(stream, {
//             mimeType: "audio/webm",
//           });
//           mediaRecorderRef.current.ondataavailable = (event) => {
//             chunksRef.current.push(event.data);
//           };
//           mediaRecorderRef.current.onstop = handleRecordingStop;
//           detectVoice();
//         })
//         .catch((err) => {
//           console.error("Microphone access error:", err);
//           setError(
//             "Microphone access is required. Please allow microphone permissions in your settings."
//           );
//           alert(
//             "Microphone access is required. Please allow microphone permissions in your settings."
//           );
//         });
//     };
//     const cleanupMedia = () => {
//       if (animationIdRef.current) {
//         cancelAnimationFrame(animationIdRef.current);
//       }
//       if (voiceStartTimerRef.current) {
//         clearTimeout(voiceStartTimerRef.current);
//         voiceStartTimerRef.current = null;
//       }
//       if (voiceStopTimerRef.current) {
//         clearTimeout(voiceStopTimerRef.current);
//         voiceStopTimerRef.current = null;
//       }
//       if (audioContextRef.current) {
//         audioContextRef.current.close();
//         audioContextRef.current = null;
//       }
//       if (
//         mediaRecorderRef.current &&
//         mediaRecorderRef.current.state !== "inactive"
//       ) {
//         mediaRecorderRef.current.stop();
//         mediaRecorderRef.current = null;
//       }
//       if (stream) {
//         stream.getTracks().forEach((track) => {
//           track.stop();
//         });
//         stream = null;
//       }
//       isRecordingRef.current = false;
//       setIsRecording(false);
//     };
//     const detectVoice = () => {
//       try {
//         analyser.getByteTimeDomainData(dataArray);
//         let sum = 0;
//         for (let i = 0; i < dataArray.length; i++) {
//           const sample = dataArray[i] - 128;
//           sum += sample * sample;
//         }
//         const rms = Math.sqrt(sum / dataArray.length);
//         const currentVolume = rms / 128;
//         setVolume(currentVolume);
//         const threshold = 0.05;
//         if (!isRecordingAllowed) {
//           if (isRecordingRef.current) {
//             stopRecording();
//           }
//           setIsRecording(false);
//           animationIdRef.current = requestAnimationFrame(detectVoice);
//           return;
//         }
//         if (currentVolume > threshold) {
//           if (voiceStopTimerRef.current) {
//             clearTimeout(voiceStopTimerRef.current);
//             voiceStopTimerRef.current = null;
//           }
//           if (!isRecordingRef.current && !voiceStartTimerRef.current) {
//             voiceStartTimerRef.current = setTimeout(() => {
//               startRecording();
//               voiceStartTimerRef.current = null;
//             }, VOICE_START_DEBOUNCE);
//           }
//         } else {
//           if (voiceStartTimerRef.current) {
//             clearTimeout(voiceStartTimerRef.current);
//             voiceStartTimerRef.current = null;
//           }
//           if (isRecordingRef.current && !voiceStopTimerRef.current) {
//             voiceStopTimerRef.current = setTimeout(() => {
//               stopRecording();
//               voiceStopTimerRef.current = null;
//             }, VOICE_STOP_DEBOUNCE);
//           }
//         }
//         animationIdRef.current = requestAnimationFrame(detectVoice);
//       } catch (error) {
//         console.error("Error in detectVoice:", error);
//         // Reinitialize media on error
//         if (isComponentMounted) {
//           cleanupMedia();
//           initializeMedia();
//         }
//       }
//     };
//     initializeMedia();
//     return () => {
//       isComponentMounted = false;
//       cleanupMedia();
//     };
//   }, [isRecordingAllowed, dispatch]);
//   useEffect(() => {
//     if (!isRecordingAllowed && isRecordingRef.current) {
//       stopRecording();
//     }
//   }, [isRecordingAllowed]);
//   const startRecording = () => {
//     if (
//       mediaRecorderRef.current &&
//       mediaRecorderRef.current.state === "inactive"
//     ) {
//       mediaRecorderRef.current.start();
//       isRecordingRef.current = true;
//       setIsRecording(true);
//       console.log("Recording started");
//       if (onRecordingStart) {
//         onRecordingStart();
//       }
//     }
//   };
//   const stopRecording = () => {
//     if (
//       mediaRecorderRef.current &&
//       mediaRecorderRef.current.state === "recording"
//     ) {
//       mediaRecorderRef.current.stop();
//       isRecordingRef.current = false;
//       setIsRecording(false);
//       console.log("Recording stopped");
//     }
//   };
//   const handleRecordingStop = () => {
//     if (isUploadingRef.current) {
//       console.warn("Already uploading. Not starting a new upload.");
//       return;
//     }
//     const blob = new Blob(chunksRef.current, { type: "audio/webm" });
//     chunksRef.current = [];
//     const requestSentTime = Date.now();
//     if (onRecordingStop) {
//       onRecordingStop(requestSentTime);
//     }
//     const formData = new FormData();
//     formData.append("audio", blob, `${uname}_audio_${current}.webm`);
//     formData.append("uname", uname);
//     formData.append("phoneNumber", phoneNumber);
//     formData.append("selectedAvatar", selectedAvatar);
//     isUploadingRef.current = true;
//     dispatch(clearAudioSrc());
//     dispatch(uploadRequest(formData))
//       .unwrap()
//       .then((response) => {
//         console.log("Upload successful:", response);
//       })
//       .catch((error) => {
//         console.error("Upload failed:", error);
//       })
//       .finally(() => {
//         isUploadingRef.current = false;
//       });
//     dispatch(setNotePlaying());
//   };
//   return (
//     <Box
//       sx={{
//         textAlign: "center",
//         marginTop: "10px",
//         //backgroundColor: "lightblue",
//       }}
//     >
//       {/* Recording Icon */}
//       <Box
//         sx={{
//           width: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
//           height: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
//           display: "flex",
//           justifyContent: "center",
//           alignItems: "center",
//           margin: "0 auto",
//           //backgroundColor: "lightgreen",
//         }}
//       >
//         {!isRecordingAllowed ? (
//           <MicOffIcon
//             className={classes.icon}
//             sx={{
//               fontSize: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
//               color: "gray",
//             }}
//           />
//         ) : (
//           <GraphicEqIcon
//             className={`${classes.icon} ${isRecording ? classes.animate : ""}`}
//             sx={{
//               fontSize: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
//               color: isRecording ? "#4CAF50" : "gray",
//             }}
//           />
//         )}
//       </Box>
//       <Typography
//         sx={{
//           marginTop: "0px",
//           fontSize: { xs: "14px", sm: "16px", md: "18px", lg: "20px" },
//           color: isRecording ? "#4CAF50" : "gray",
//           minHeight: "1em",
//           //backgroundColor: "lightcoral",
//         }}
//       >
//         {getRecordingStatusMessage()}
//       </Typography>
//       {/* Error Message */}
//       {error && (
//         <Typography sx={{ color: "red", backgroundColor: "lightyellow" }}>
//           {error}
//         </Typography>
//       )}
//     </Box>
//   );
//   // return (
//   //   <div
//   //     style={{
//   //       textAlign: "center",
//   //       marginTop: "10px",
//   //       height: "100%",
//   //       display: "flex",
//   //       flexDirection: "column",
//   //       justifyContent: "center",
//   //     }}
//   //   >
//   //     {/* 아이콘 컨테이너 */}
//   //     <div
//   //       style={{
//   //         width: "70px",
//   //         height: "60px",
//   //         display: "flex",
//   //         justifyContent: "center",
//   //         alignItems: "center",
//   //         margin: "0 auto",
//   //         marginTop: "5px",
//   //       }}
//   //     >
//   //       {!isRecordingAllowed ? (
//   //         <MicOffIcon className={classes.icon} style={{ color: "gray" }} />
//   //       ) : (
//   //         <GraphicEqIcon
//   //           className={`${classes.icon} ${isRecording ? classes.animate : ""}`}
//   //           style={{ color: isRecording ? "#4CAF50" : "gray" }}
//   //         />
//   //       )}
//   //     </div>
//   //     {/* 메시지 컨테이너 */}
//   //     <div
//   //       style={{
//   //         minHeight: "1em",
//   //         marginTop: "0px",
//   //       }}
//   //     >
//   //       <p
//   //         style={{
//   //           fontSize: "20px",
//   //           color: isRecording ? "#4CAF50" : "gray",
//   //           margin: 0,
//   //         }}
//   //       >
//   //         {getRecordingStatusMessage()}
//   //       </p>
//   //     </div>
//   //     {/* 에러 메시지 */}
//   //     {error && <p style={{ color: "red" }}>{error}</p>}
//   //   </div>
//   // );
// };
// AudioRecorder.propTypes = {
//   uname: PropTypes.string.isRequired,
//   phoneNumber: PropTypes.string.isRequired,
//   selectedAvatar: PropTypes.string.isRequired,
//   onRecordingStart: PropTypes.func,
//   onRecordingStop: PropTypes.func,
//   isRecordingAllowed: PropTypes.bool.isRequired,
// };
// export default AudioRecorder;

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  clearAudioSrc,
  uploadRequest,
  setNotePlaying,
  setAudioErrorOccurred,
} from "@store/ai/aiConsultSlice";
import PropTypes from "prop-types";
// Import MUI components and icons
import { makeStyles } from "@mui/styles";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import MicOffIcon from "@mui/icons-material/MicOff";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const useStyles = makeStyles({
  icon: {
    transition: "transform 0.1s",
  },
  animate: {
    animation: "$pulse 1s infinite",
    transformOrigin: "center center",
    willChange: "transform",
  },
  "@keyframes pulse": {
    "0%": {
      transform: "scale(1)",
    },
    "50%": {
      transform: "scale(1.2)",
    },
    "100%": {
      transform: "scale(1)",
    },
  },
});

const AudioRecorder = ({
  uname,
  phoneNumber,
  selectedAvatar,
  onRecordingStart,
  onRecordingStop,
  isRecordingAllowed,
}) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const current = useSelector((state) => state.aiConsult.audio.current);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const animationIdRef = useRef(null);
  const voiceStartTimerRef = useRef(null);
  const voiceStopTimerRef = useRef(null);
  const VOICE_START_DEBOUNCE = 50;
  const VOICE_STOP_DEBOUNCE = 1700;
  const isUploadingRef = useRef(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // 추가된 부분: stream을 참조하기 위한 ref 생성
  const streamRef = useRef(null);

  // 현재 사용 중인 오디오 입력 장치 ID를 저장하기 위한 ref
  const currentDeviceIdRef = useRef(null);

  const getRecordingStatusMessage = () => {
    if (!isRecordingAllowed) return "";
    return "상담사에게 말씀해주세요";
  };

  useEffect(() => {
    let isComponentMounted = true;
    let analyser = null;
    let dataArray = null;

    // 사용 가능한 오디오 입력 장치 목록을 가져와 현재 활성화된 장치를 선택
    const getAvailableAudioInputDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputDevices = devices.filter(
          (device) => device.kind === "audioinput"
        );
        return audioInputDevices;
      } catch (err) {
        console.error("Error enumerating devices:", err);
        setError("장치 목록을 가져오는 중 에러가 발생했습니다.");
        return [];
      }
    };

    // 우선순위에 따라 오디오 입력 장치를 선택 (예: 기본 장치 사용)
    const selectAudioInputDevice = (devices) => {
      if (devices.length === 0) {
        setError("오디오 입력 장치를 찾을 수 없습니다.");
        return null;
      }
      // 예를 들어, 첫 번째 장치를 선택. 필요에 따라 다른 로직 적용 가능
      return devices[0].deviceId;
    };

    const initializeMedia = async () => {
      if (!isComponentMounted) return;
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.error("This browser does not support Web Audio API.");
        setError("Your browser does not support Web Audio API.");
        return;
      }

      const audioInputDevices = await getAvailableAudioInputDevices();
      const selectedDeviceId = selectAudioInputDevice(audioInputDevices);

      if (!selectedDeviceId) {
        dispatch(setAudioErrorOccurred());
        return;
      }

      currentDeviceIdRef.current = selectedDeviceId;

      const constraints = {
        audio: {
          deviceId: { exact: selectedDeviceId },
        },
      };

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );
        if (!isComponentMounted) return;
        streamRef.current = mediaStream;

        // 기존 트랙 종료 핸들러 제거 (중복 호출 방지)
        streamRef.current.getTracks().forEach((track) => {
          track.onended = null;
        });

        // 새로 연결된 장치의 트랙 종료 시 핸들러 설정
        streamRef.current.getTracks().forEach((track) => {
          track.onended = () => {
            console.log("Microphone input device changed or disconnected");
            cleanupMedia();
            initializeMedia();
          };
        });

        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        const sourceNode = audioContextRef.current.createMediaStreamSource(
          streamRef.current
        );
        analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 512;
        sourceNode.connect(analyser);
        dataArray = new Uint8Array(analyser.fftSize);
        mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
          mimeType: "audio/webm",
        });
        mediaRecorderRef.current.ondataavailable = (event) => {
          chunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.onstop = handleRecordingStop;
        detectVoice();
      } catch (err) {
        console.error("Microphone access error:", err);
        setError(
          "마이크 접근 권한이 필요합니다. 설정에서 마이크 권한을 허용해주세요."
        );
        alert(
          "마이크 접근 권한이 필요합니다. 설정에서 마이크 권한을 허용해주세요."
        );
        dispatch(setAudioErrorOccurred());
      }
    };

    const handleDeviceChange = async () => {
      console.log("Media devices changed");
      // 현재 사용 중인 장치가 여전히 존재하는지 확인
      const audioInputDevices = await getAvailableAudioInputDevices();
      const isCurrentDeviceAvailable = audioInputDevices.some(
        (device) => device.deviceId === currentDeviceIdRef.current
      );

      if (!isCurrentDeviceAvailable) {
        console.log("Current audio input device is no longer available.");
        cleanupMedia();
        initializeMedia();
      } else {
        console.log("Current audio input device is still available.");
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    const cleanupMedia = () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (voiceStartTimerRef.current) {
        clearTimeout(voiceStartTimerRef.current);
        voiceStartTimerRef.current = null;
      }
      if (voiceStopTimerRef.current) {
        clearTimeout(voiceStopTimerRef.current);
        voiceStopTimerRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    const detectVoice = () => {
      if (!analyser || !dataArray) {
        console.error("Analyser or dataArray is not initialized.");
        return;
      }

      try {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const sample = dataArray[i] - 128;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const currentVolume = rms / 128;
        setVolume(currentVolume);
        const threshold = 0.05;

        if (!isRecordingAllowed) {
          if (isRecordingRef.current) {
            stopRecording();
          }
          setIsRecording(false);
          animationIdRef.current = requestAnimationFrame(detectVoice);
          return;
        }

        if (currentVolume > threshold) {
          if (voiceStopTimerRef.current) {
            clearTimeout(voiceStopTimerRef.current);
            voiceStopTimerRef.current = null;
          }
          if (!isRecordingRef.current && !voiceStartTimerRef.current) {
            voiceStartTimerRef.current = setTimeout(() => {
              startRecording();
              voiceStartTimerRef.current = null;
            }, VOICE_START_DEBOUNCE);
          }
        } else {
          if (voiceStartTimerRef.current) {
            clearTimeout(voiceStartTimerRef.current);
            voiceStartTimerRef.current = null;
          }
          if (isRecordingRef.current && !voiceStopTimerRef.current) {
            voiceStopTimerRef.current = setTimeout(() => {
              stopRecording();
              voiceStopTimerRef.current = null;
            }, VOICE_STOP_DEBOUNCE);
          }
        }
        animationIdRef.current = requestAnimationFrame(detectVoice);
      } catch (error) {
        console.error("Error in detectVoice:", error);
        if (isComponentMounted) {
          cleanupMedia();
          initializeMedia();
        }
      }
    };

    initializeMedia();

    return () => {
      isComponentMounted = false;
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
      cleanupMedia();
    };
  }, [isRecordingAllowed, dispatch]);

  useEffect(() => {
    if (!isRecordingAllowed && isRecordingRef.current) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecordingAllowed]);

  const startRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "inactive"
    ) {
      mediaRecorderRef.current.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      console.log("Recording started");
      if (onRecordingStart) {
        onRecordingStart();
      }
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      console.log("Recording stopped");
    }
  };

  const handleRecordingStop = () => {
    if (isUploadingRef.current) {
      console.warn("Already uploading. Not starting a new upload.");
      return;
    }
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    const requestSentTime = Date.now();
    if (onRecordingStop) {
      onRecordingStop(requestSentTime);
    }
    const formData = new FormData();
    formData.append("audio", blob, `${uname}_audio_${current}.webm`);
    formData.append("uname", uname);
    formData.append("phoneNumber", phoneNumber);
    formData.append("selectedAvatar", selectedAvatar);
    isUploadingRef.current = true;
    dispatch(clearAudioSrc());
    dispatch(uploadRequest(formData))
      .unwrap()
      .then((response) => {
        console.log("Upload successful:", response);
      })
      .catch((error) => {
        console.error("Upload failed:", error);
      })
      .finally(() => {
        isUploadingRef.current = false;
      });
    dispatch(setNotePlaying());
  };

  return (
    <Box
      sx={{
        textAlign: "center",
        marginTop: "10px",
      }}
    >
      {/* Recording Icon */}
      <Box
        sx={{
          width: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
          height: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          margin: "0 auto",
        }}
      >
        {!isRecordingAllowed ? (
          <MicOffIcon
            className={classes.icon}
            sx={{
              fontSize: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
              color: "gray",
            }}
          />
        ) : (
          <GraphicEqIcon
            className={`${classes.icon} ${isRecording ? classes.animate : ""}`}
            sx={{
              fontSize: { xs: "35px", sm: "45px", md: "55px", lg: "65px" },
              color: isRecording ? "#4CAF50" : "gray",
            }}
          />
        )}
      </Box>
      <Typography
        sx={{
          marginTop: "0px",
          fontSize: { xs: "14px", sm: "16px", md: "18px", lg: "20px" },
          color: isRecording ? "#4CAF50" : "gray",
          minHeight: "1em",
        }}
      >
        {getRecordingStatusMessage()}
      </Typography>
      {/* Error Message */}
      {error && (
        <Typography sx={{ color: "red", backgroundColor: "lightyellow" }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

AudioRecorder.propTypes = {
  uname: PropTypes.string.isRequired,
  phoneNumber: PropTypes.string.isRequired,
  selectedAvatar: PropTypes.string.isRequired,
  onRecordingStart: PropTypes.func,
  onRecordingStop: PropTypes.func,
  isRecordingAllowed: PropTypes.bool.isRequired,
};

export default AudioRecorder;
