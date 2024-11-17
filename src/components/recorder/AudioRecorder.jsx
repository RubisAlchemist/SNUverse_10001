import { useEffect, useRef, useState, useCallback } from "react";
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
  const isErrorOccurred = useSelector(
    (state) => state.aiConsult.audio.isErrorOccurred
  );
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const animationIdRef = useRef(null);
  const voiceStartTimerRef = useRef(null);
  const voiceStopTimerRef = useRef(null);
  const VOICE_START_DEBOUNCE = 50;
  const VOICE_STOP_DEBOUNCE = 2500;
  const isUploadingRef = useRef(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // 추가된 부분: stream을 참조하기 위한 ref 생성
  const streamRef = useRef(null);

  // 현재 사용 중인 오디오 입력 장치 ID를 저장하기 위한 ref
  const currentDeviceIdRef = useRef(null);

  // 에러 핸들러 함수 추가
  // const handleAudioError = useCallback(
  //   (errorMessage) => {
  //     console.error("AudioRecorder 에러 발생:", errorMessage);
  //     setError(errorMessage);
  //     dispatch(setAudioErrorOccurred());
  //   },
  //   [dispatch]
  // );

  // 상태 변화 로깅
  useEffect(() => {
    console.log("isErrorOccurred 상태 변경:", isErrorOccurred);
  }, [isErrorOccurred]);

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
        console.log("사용 가능한 오디오 입력 장치:", audioInputDevices);
        return audioInputDevices;
      } catch (err) {
        console.error("장치 목록을 가져오는 중 에러가 발생했습니다.", err);

        // handleAudioError("장치 목록을 가져오는 중 에러가 발생했습니다.");
        return [];
      }
    };

    // 우선순위에 따라 오디오 입력 장치를 선택 (예: 기본 장치 사용)
    const selectAudioInputDevice = (devices) => {
      if (devices.length === 0) {
        console.log("오디오 입력 장치를 찾을 수 없습니다.");
        // handleAudioError("오디오 입력 장치를 찾을 수 없습니다.");
        return null;
      }
      // 예를 들어, 첫 번째 장치를 선택. 필요에 따라 다른 로직 적용 가능
      return devices[0].deviceId;
    };

    const initializeMedia = async () => {
      if (!isComponentMounted) return;
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.error("This browser does not support Web Audio API.");
        // handleAudioError("Your browser does not support Web Audio API.");
        return;
      }

      const audioInputDevices = await getAvailableAudioInputDevices();
      const selectedDeviceId = selectAudioInputDevice(audioInputDevices);

      if (!selectedDeviceId) {
        // handleAudioError already called in selectAudioInputDevice
        return;
      }

      currentDeviceIdRef.current = selectedDeviceId;
      console.log("선택된 오디오 입력 장치 ID:", selectedDeviceId);

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
        console.log("MediaStream 초기화 완료:", mediaStream);

        // 기존 트랙 종료 핸들러 제거 (중복 호출 방지)
        streamRef.current.getTracks().forEach((track) => {
          track.onended = null;
        });

        // 새로 연결된 장치의 트랙 종료 시 핸들러 설정
        streamRef.current.getTracks().forEach((track) => {
          track.onended = () => {
            console.log("마이크 장치가 변경되거나 연결이 끊어졌습니다.");
            // handleAudioError("마이크 장치가 변경되거나 연결이 끊어졌습니다.");
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
        mediaRecorderRef.current.onerror = (event) => {
          console.error("MediaRecorder 오류:", event.error);
          // handleAudioError(`MediaRecorder 오류: ${event.error.name}`);
        };
        detectVoice();
      } catch (err) {
        console.error(
          "마이크 접근 권한이 필요합니다. 설정에서 마이크 권한을 허용해주세요.",
          err
        );
        // handleAudioError(
        //   "마이크 접근 권한이 필요합니다. 설정에서 마이크 권한을 허용해주세요."
        // );
        alert(
          "마이크 접근 권한이 필요합니다. 설정에서 마이크 권한을 허용해주세요."
        );
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
        console.log("현재 오디오 입력 장치 사용 불가");
        // handleAudioError("현재 오디오 입력 장치 사용 불가");
        cleanupMedia();
        initializeMedia();
      } else {
        console.log("Current audio input device is still available.");
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    console.log("devicechange 이벤트 리스너 추가");

    const cleanupMedia = () => {
      console.log("미디어 스트림 정리 시작");
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
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
        try {
          mediaRecorderRef.current.stop();
          console.log("MediaRecorder 정지");
        } catch (err) {
          console.error("MediaRecorder 정지 중 오류:", err);
        }
        mediaRecorderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
        console.log("MediaStream 트랙 정지");
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      console.log("미디어 스트림 정리 완료");
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
          console.log("음성 감지 중 오류 발생");
          // handleAudioError("음성 감지 중 오류 발생");
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
      console.log("devicechange 이벤트 리스너 제거");
      cleanupMedia();
    };
    // }, [isRecordingAllowed, dispatch, handleAudioError]);
  }, [isRecordingAllowed, dispatch]);

  useEffect(() => {
    if (!isRecordingAllowed && isRecordingRef.current) {
      console.log("isRecordingAllowed가 false로 변경되어 녹음 중지");
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

  const handleRecordingStop = useCallback(() => {
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
        console.error("업로드 중 오류가 발생했습니다.", error);
        // handleAudioError("업로드 중 오류가 발생했습니다.");
      })
      .finally(() => {
        isUploadingRef.current = false;
      });
    dispatch(setNotePlaying());
  }, [
    dispatch,
    uname,
    phoneNumber,
    selectedAvatar,
    current,
    onRecordingStop,
    // handleAudioError,
  ]);

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
