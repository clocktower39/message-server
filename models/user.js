const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require("dotenv").config({ quiet: true });
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, index: { unique: true } },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    profilePicture: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "profilePictures.files"
    },
}, { minimize: false })

UserSchema.pre("save", async function () {
    const user = this;

    if (!user.isModified("password")) {
        return;
    }

    const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
    user.password = await bcrypt.hash(user.password, salt);
});

UserSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);
module.exports = User;
