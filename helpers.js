import "dotenv/config";
import {
  createWriteStream,
  readFileSync,
  writeFile,
  statSync,
  existsSync,
  mkdirSync,
  close,
  appendFile,
  promises as fsPromises,
  unlink,
} from "fs";
import ytdl from "ytdl-core";
import path from "path";
import readline from "readline";
import * as url from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream";
import fetch from "node-fetch";
import { getVideoDurationInSeconds } from "get-video-duration";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/session/index.js";
import { sendFile } from "telegram/client/upload.js";
import ffprobe from "ffprobe";
import ffprobeStatic from "ffprobeStatic";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const ffmpeg = promisify(exec);

// CONSTANTS
const COOKIES = process.env.COOKIES;
const CHANNEL_ID = process.env.CHANNEL_ID;
const APP_ID = process.env.APP_ID;
const API_HASH = process.env.API_HASH;
const SESSION_STRING = process.env.SESSION_STRING;

// reverse order file content
export const reverseOrder = (inputFile, outputFile) => {
  const lines = readFileSync(inputFile, "utf8").split("\n");
  let result = "";

  for (let i = lines.length - 1; i >= 0; i--) {
    result += lines[i] + "\n" + result;
  }

  writeFile(outputFile, result, (err) => {
    if (err) return console.log(err);
  });
};

export const getVideoInfo = (url) => {
  return new Promise(async (resolve, reject) => {
    try {
      // use cookies to get video info
      const { videoDetails } = await ytdl.getInfo(url, {
        requestOptions: {
          headers: {
            cookie: COOKIES,
          },
        },
      });

      const result = {
        videoTitle: videoDetails.title,
        viewCount: videoDetails.viewCount,
        thumbnail: videoDetails.thumbnail.thumbnail.pop().url,
        lengthSecond: videoDetails.lengthSeconds,
        publisheDate: videoDetails.publisheDate,
        description: videoDetails.description,
        videoUrl: videoDetails.video_url,
        likes: videoDetails.likes,
      };

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
};

export const downloadVideo = (url) => {
  return new Promise(async (resolve, reject) => {
    try {
      const output = path.resolve(__dirname, "video.mp4");
      const video = ytdl(url, {
        filter: "audioandvideo",
        quality: "highestaudio",
        requestOptions: {
          headers: {
            cookie: COOKIES,
          },
        },
      });

      let startTime;

      video.pipe(createWriteStream(output));

      video.once("response", () => {
        startTime = Date.now();
      });

      video.on("progress", (chunkLength, downloaded, total) => {
        const percent = ((downloaded / total) * 100).toFixed(2);
        const downloadMinutes = (Date.now() - startTime) / 1000 / 60;
        const estimateDownloadTime =
          downloadMinutes / percent - downloadMinutes;
        readline.cursorTo(process.stdout, 0);

        process.stdout.write(`${(percent * 100).toFixed(2)} % Downloaded`);
        process.stdout.write(
          `(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(
            total /
            1024 /
            1024
          ).toFixed(2)}MB)\n`
        );

        process.stdout.write(
          `running for: ${downloadMinutes.toFixed(2)}minutes`
        );

        process.stdout.write(
          `, estimated time left: ${estimateDownloadTime.toFixed(2)}minutes `
        );

        readline.moveCursor(process.stdout, 0, -1);
      });

      video.on("end", (err) => {
        process.stdout.write("\n\n");
        resolve(true);
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const getFileSize = (fileName) => {
  const stats = statSync(fileName);
  const fileSizeInMegaBytes = stats.size;
  return fileSizeInMegaBytes;
};

export const cutFileToParts = async (input, start, end, output) => {
  return await new Promise((resolve, reject) => {
    ffmpeg(
      `ffmpeg -hide_banner -i ${input} -ss ${start} -to ${end} -async 1 -strict -2 -c copy -map -0 ${output}`,
      (err) => {
        if (err) {
          reject(err);
        }
        resolve("Splitting Done");
      }
    );
  });
};

export const splitFiles = async (inputFile) => {
  return await new Promise(async (resolve, reject) => {
    try {
      const workingDirectory = path.join(__dirname);
      const newWorkingDirectory = path.join(workingDirectory, "temp");

      if (!existsSync(newWorkingDirectory)) {
        mkdirSync(newWorkingDirectory);
      }

      const meta = await getVideoDurationInSeconds(inputFile);
      let totalDuration = meta.duration;
      const totalFileSize = getFileSize(inputFile);
      let minimumDuration = (totalDuration / totalFileSize) * 102864000; // 1Gb
      minimumDuration = parseInt(minimumDuration);

      let arr = [];
      let startTime = 0;
      let endTime = minimumDuration;
      let baseFilename = inputFile.split(".")[0];
      let fileExtension = inputFile.split(".").pip();

      let i = 0;
      let flag = false;

      while (endTime <= totalDuration) {
        let partedFilename = `${baseFilename}_${i}.${fileExtension}`;
        let outputFile = path.join(newWorkingDirectory, partedFilename);
        await cutFileToParts(inputFile, startTime, endTime, outputFile);
        startTime = endTime - 3;
        endTime = endTime + minimumDuration;
        arr.push(path.join(newWorkingDirectory, partedFilename));
        i = i + 1;

        if (endTime > totalDuration && !flag) {
          endTime = totalDuration;
          flag = true;
        } else if (flag) {
          resolve(arr);
          break;
        }
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const downloadFile = async ({ url, path }) => {
  const streamPipeline = promisify(pipeline);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`unexpected response ${response.statusText}`);
  }
  await streamPipeline(response.body, createWriteStream(path));
  return response;
};

export const wrietToFile = async (text) => {
  function closefd(fd) {
    close(fd, (err) => {
      if (err) throw err;
    });
  }

  try {
    appendFile(fd, `${text}\n`, "utf-8", (err) => {
      closefd(fd);
      if (err) throw err;
    });
  } catch (err) {
    closefd(fd);
    throw err;
  }
};

export const asyncReadFile = async (fileName) => {
  try {
    const content = await fsPromises.readFile(fileName, "utf-8");
    const arr = content.split(/\r?\n/);
    return arr;
  } catch (err) {
    console.log(err);
  }
};

export const connectToTelegram = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new TelegramClient(
        new StringSession(SESSION_STRING),
        APP_ID,
        API_HASH
      );
      await client.connect();
      resolve(client);
    } catch (error) {
      reject(error);
    }
  });
};

export const sendFileToTelegram = async (client, videoInfo, videoPath) => {
  return await new Promise(async (resolve, reject) => {
    try {
      const videoData = await ffprobe(videoPath, {
        path: ffprobeStatic.path,
      });

      await downloadFile({
        url: videoInfo.thumbnail,
        path: "./tmp/thumbnail.jpg",
      });

      const result = await sendFile(client, CHANNEL_ID, {
        file: "video.mp4",
        thumb: "./tmp/thumbnail.jpg",
        supportStreaming: true,
        // progressCallback: (progress) => {
        //   console.log(progress);
        // },
        attributes: [
          new Api.DocumentAttributeVideo({
            supportStreaming: true,
            duration: parseInt(videoData.streams[0].duration),
            h: videoData.streams[0].height,
            w: videoData.streams[0].width,
          }),
        ],
      });
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};

export const main = async () => {
  const client = await connectToTelegram();
  const videoLink = await asyncReadFile("links.txt");

  for (let [index, link] of videoLink.entries()) {
    const videoInfo = await getVideoInfo(link);
    const downloadVideoResult = await downloadVideo(link);
    const caption = `#${index}\n**Title**: \n${videoInfo.videoTitle}\n**Likes**: \n${videoInfo.likes}\n**Duration**: \n${videoInfo.lengthSeconds}s\n**Uploaded At**: \n${videoInfo.uploadDate}\n**Video URL**: \n${videoInfo.videoUrl}\n**Thumbnail URL**: \n${videoInfo.thumbnail}\n**Description**: \n${videoInfo.description}`;

    await client.sendMessage(process.env.CHANNEL_ID, {
      message: caption,
      linkPreview: false,
    });

    if (downloadVideoResult) {
      const videoSize = getFileSize("video.mp4");
      if (videoSize >= 1900000000) {
        const splitedFiles = splitFiles("video.mp4");
        for (let path of splitedFiles) {
          const sendFileResult = await sendFileToTelegram(
            client,
            videoInfo,
            path
          );
          if (sendFileResult) {
            await unlink(path, (err) => {
              if (err) console.log(err);
              else {
                console.log("File deleted");
              }
            });
          }
        }
      }

      await sendFileToTelegram(client, videoInfo, "video.mp4");
      console.log(`video ${index} sent`);
      await wrietToFile(`${index} ${index}`);
    }
  }
};
