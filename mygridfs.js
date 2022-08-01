const { GridFsStorage } = require('multer-gridfs-storage');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
require("dotenv").config();

const dbUrl = process.env.DBURL;

// Storage
const storage = new GridFsStorage({
    url: dbUrl,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString("hex") + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: "profilePictures",
                };
                resolve(fileInfo);
            });
        });
    }
});

const upload = multer({
    storage
});


module.exports = {
    upload,
}