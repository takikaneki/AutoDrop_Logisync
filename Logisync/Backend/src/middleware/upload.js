
const multer = require("multer");

const allowedMimeTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg"
];

const maxSize =
  Number(process.env.MAX_VIDEO_SIZE_MB || 50) * 1024 * 1024;

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only supported video files are allowed."));
    }

    cb(null, true);
  }
});

module.exports = { uploadVideo };
