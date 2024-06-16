import * as fs from 'fs';

export const deleteUploadedAndChangedMedia = async (path: string) => {
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true, force: true });
        fs.mkdirSync(path);
    }
};