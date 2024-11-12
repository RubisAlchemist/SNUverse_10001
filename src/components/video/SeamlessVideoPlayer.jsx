import React, { useEffect, useRef, useState, forwardRef } from "react";
const SeamlessVideoPlayer = forwardRef((props, ref) => {
  const {
    initialVideoUrl,
    onEnded,
    onStart,
    onAllVideosEnded,
    onError,
    onPause,
    onPlay,
  } = props;

  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const queuedVideos = useRef([]);
  const [canPlay, setCanPlay] = useState(false);
  const baseUrl = useRef("");
  const initialUrlSet = useRef(false);
  const isStopped = useRef(false);
  const currentIndexRef = useRef(0);
  const fetchInProgress = useRef({});
  const retryCounts = useRef({});
  const RETRY_DELAY = 1000; // 1 second delay between retries
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    if (!initialUrlSet.current && initialVideoUrl) {
      console.log("initialVideoUrl: ", initialVideoUrl);
      const urlPart = initialVideoUrl.videoPath
        .split("/video/")[1]
        .split(/(_\d+)?\.webm$/)[0];
      baseUrl.current = `/proxy/video/${urlPart}`;
      initialUrlSet.current = true;
    }
    console.log("seamlessVideoPlayer: ", initialVideoUrl.videoPath);
  }, [initialVideoUrl]);

  const getVideoUrl = (index) => {
    if (index === "final") {
      return `${baseUrl.current}_final.webm`;
    } else {
      return `${baseUrl.current}_${index}.webm`;
    }
  };

  const fetchAndAppendVideo = async (index) => {
    if (isStopped.current) {
      console.log("isStopped.current is true, exiting fetchAndAppendVideo");
      return;
    }
    if (fetchInProgress.current[index]) {
      console.log(`Fetch for index ${index} already in progress, exiting`);
      return;
    }
    fetchInProgress.current[index] = true;

    const url = getVideoUrl(index);
    console.log(url);
    const mediaSource = mediaSourceRef.current;
    retryCounts.current[index] = 0;

    const MAX_RETRIES_BEFORE_FINAL_CHECK = 3;

    while (!isStopped.current) {
      try {
        console.log(`Attempting to fetch video ${index}`);
        const response = await fetch(url, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Add this check for zero-byte arrayBuffer
        if (arrayBuffer.byteLength === 0) {
          throw new Error("Fetched video segment is empty");
        }

        fetchInProgress.current[index] = false;
        retryCounts.current[index] = 0;

        // Add to queue
        queuedVideos.current.push(arrayBuffer);

        // Append if possible
        if (
          mediaSource &&
          mediaSource.readyState === "open" &&
          sourceBufferRef.current &&
          !sourceBufferRef.current.updating
        ) {
          appendNextVideo();
        }

        // Fetching successful, proceed to next index
        currentIndexRef.current = index + 1;
        // Proceed to fetch next segment
        fetchAndAppendVideo(currentIndexRef.current);
        return;
      } catch (error) {
        retryCounts.current[index] += 1;
        console.error(
          `Error fetching video ${index}, retry ${retryCounts.current[index]}:`,
          error
        );
        if (retryCounts.current[index] % MAX_RETRIES_BEFORE_FINAL_CHECK === 0) {
          console.log(
            `Reached ${retryCounts.current[index]} retries for video ${index}. Checking for final video.`
          );
          await checkForFinalVideo();
          if (isStopped.current) {
            fetchInProgress.current[index] = false;
            return;
          }
        }
        await sleep(RETRY_DELAY);
        // Continue loop to retry
        if (retryCounts.current[index] >= 7 && onError) {
          onError(error);
          return;
        }
      }
    }

    fetchInProgress.current[index] = false;
  };

  const checkForFinalVideo = async () => {
    if (isStopped.current) return;
    const finalUrl = getVideoUrl("final");
    const mediaSource = mediaSourceRef.current;
    try {
      console.log("Checking for '_final' video.");
      const response = await fetch(finalUrl, {
        credentials: "include",
      });
      if (response.ok) {
        // '_final' video exists
        console.log(
          `'_final' video exists. Will end stream after buffered videos.`
        );
        isStopped.current = true;
        // If buffer is empty, end stream immediately
        if (
          queuedVideos.current.length === 0 &&
          mediaSource &&
          mediaSource.readyState === "open"
        ) {
          mediaSource.endOfStream();
        }
        // Else, allow buffered videos to play out
      } else {
        // '_final' video does not exist, continue fetching
        console.log(`'_final' video does not exist. Continuing to retry.`);
      }
    } catch (error) {
      console.error("Error checking for '_final' video:", error);
      // Decide whether to stop or continue retrying
      // For now, we'll continue retrying
    }
  };

  const appendNextVideo = () => {
    const mediaSource = mediaSourceRef.current;
    if (
      queuedVideos.current.length > 0 &&
      mediaSource &&
      mediaSource.readyState === "open" &&
      sourceBufferRef.current &&
      !sourceBufferRef.current.updating
    ) {
      const nextVideo = queuedVideos.current.shift();
      console.log("Appending video segment, size:", nextVideo.byteLength);
      try {
        sourceBufferRef.current.appendBuffer(nextVideo);
        console.log("Buffer appended successfully.");
      } catch (error) {
        console.error("Error appending buffer:", error);
        // Re-queue the video and retry later
        queuedVideos.current.unshift(nextVideo);
        if (onError) {
          onError(error);
        }
      }
    } else if (isStopped.current && queuedVideos.current.length === 0) {
      // If we've been instructed to stop and the buffer is empty, end the stream
      if (mediaSource && mediaSource.readyState === "open") {
        console.log("Ending stream after all videos have been appended.");
        mediaSource.endOfStream();
      }
    }
  };

  const onUpdateEnd = () => {
    appendNextVideo();

    // Set canPlay to true after the first video is appended
    if (!canPlay) {
      setCanPlay(true);
    }
  };

  const sourceOpen = (e) => {
    console.log("sourceOpen()");
    const mediaSource = e.target;
    try {
      const mimeType = 'video/webm; codecs="vp8, vorbis"';
      sourceBufferRef.current = mediaSource.addSourceBuffer(mimeType);
      sourceBufferRef.current.mode = "sequence";
      sourceBufferRef.current.addEventListener("updateend", onUpdateEnd);
      console.log(
        "MediaSource readyState after sourceOpen:",
        mediaSource.readyState
      );
      // Start by fetching the first video
      currentIndexRef.current = 0;
      fetchAndAppendVideo(currentIndexRef.current);
    } catch (error) {
      console.error("Error during sourceOpen:", error);
    }
  };

  const handleVideoError = (error) => {
    console.error("SeamlessVideoPlayer: Video playback error", error);
    isStopped.current = true;
    if (
      mediaSourceRef.current &&
      mediaSourceRef.current.readyState === "open"
    ) {
      try {
        mediaSourceRef.current.endOfStream();
      } catch (e) {
        console.error("Error ending media source stream:", e);
      }
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (onError) {
      onError(error);
    }
  };

  useEffect(() => {
    isStopped.current = false; // 컴포넌트 마운트 시 isStopped를 false로 재설정

    const video = videoRef.current;
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    video.src = URL.createObjectURL(mediaSource);
    const handleSourceOpen = (e) => sourceOpen(e);
    mediaSource.addEventListener("sourceopen", handleSourceOpen);

    // 비디오 이벤트 핸들러 등록
    const handlePause = () => {
      console.log("SeamlessVideoPlayer: Video paused");
      if (!video.seeking && !video.ended && !isStopped.current) {
        handleVideoError(new Error("Video paused unexpectedly"));
      }
    };
    const handleStalled = () => {
      console.log("SeamlessVideoPlayer: Video stalled");
      handleVideoError(new Error("Video stalled"));
    };
    const handleError = (e) => {
      console.error("SeamlessVideoPlayer: Video error", e);
      handleVideoError(e);
    };

    video.addEventListener("pause", handlePause);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("error", handleError);

    const handleEnded = () => {
      console.log("Playback ended.");
      onAllVideosEnded();
    };
    video.addEventListener("ended", handleEnded);

    return () => {
      isStopped.current = true; // 컴포넌트 언마운트 시 중지

      mediaSource.removeEventListener("sourceopen", handleSourceOpen);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("error", handleError);

      if (sourceBufferRef.current) {
        sourceBufferRef.current.removeEventListener("updateend", onUpdateEnd);
        try {
          mediaSource.removeSourceBuffer(sourceBufferRef.current);
        } catch (e) {
          console.error("Error removing source buffer:", e);
        }
      }
      if (mediaSource.readyState === "open") {
        try {
          mediaSource.endOfStream();
        } catch (e) {
          console.error("Error ending media source stream:", e);
        }
      }
      URL.revokeObjectURL(video.src);
      if (video) {
        video.pause();
        video.src = "";
        video.load();
      }
    };
  }, []);

  useEffect(() => {
    if (canPlay) {
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement
          .play()
          .then(() => {
            console.log("Video started playing.");
          })
          .catch((error) => {
            console.error("Playback failed:", error);
            handleVideoError(error);
          });
      }
    }
  }, [canPlay]);

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
        if (ref) ref.current = el;
      }}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
      onPlay={(e) => {
        onStart();
        if (onPlay) onPlay(e);
      }}
      onPause={onPause}
    />
  );
});

export default SeamlessVideoPlayer;
