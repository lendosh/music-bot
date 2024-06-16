import {Context} from 'telegraf';

export interface IMedia {
    title: string,
    path?: string,
    duration?: string
}

export interface SessionData {
    media?: IMedia;
    userName?: string;
    userFolderPath: string;
}

export interface IBotContext extends Context {
    session?: SessionData;
}