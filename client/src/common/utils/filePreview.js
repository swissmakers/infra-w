const PREVIEW_EXTENSIONS = {
    image: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"],
    video: ["mp4", "webm", "ogg", "mov"],
    audio: ["mp3", "wav", "flac", "m4a"],
    pdf: ["pdf"],
};

export const getPreviewType = (filename) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    return Object.keys(PREVIEW_EXTENSIONS).find(type => PREVIEW_EXTENSIONS[type].includes(extension)) || null;
};
