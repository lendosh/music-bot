import {Command} from "./command.class";
import {Context, Markup, Telegraf} from "telegraf";
import {IBotContext} from "../context/context.interface";
import {message} from "telegraf/filters";
import {getUrlData, isHostLink} from "../utils/validations";
import ytdl from 'ytdl-core';
import * as fs from 'fs';
import * as https from "node:https";
import {deleteUploadedAndChangedMedia} from "../utils/utils";

import ffmpeg from "fluent-ffmpeg";
import {ROOT_MEDIA_PATH} from "../app";
import {MESSAGE_TEXT, PROCESS_STATUS} from "../utils/messages";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const instagramDl = require("@sasmeee/igdl");

const speedPitches = [
    '0.5',
    '0.6',
    '0.7',
    '0.75',
    '0.8',
    '0.85',
];

export class StartCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot);
    }

    handle(): void {
        this.bot.start(async (ctx) => {
            await ctx.sendMessage(MESSAGE_TEXT.WELCOME_MESSAGE);
            ctx.session ??= {
                userName: ctx.message.from.username,
                userFolderPath: `${ROOT_MEDIA_PATH}/${ctx.message.from.username}`
            };
            if (!fs.existsSync(ctx.session?.userFolderPath)) {
                fs.mkdirSync(ctx.session?.userFolderPath);
            }
        });

        this.bot.on(message('audio'), async (ctx) => {
            if (!ctx.session?.userName) {
                await ctx.sendMessage('Для начала работы напишите комманду /start');
                return;
            }

            const audioInfo = ctx.message.audio;
            const audio = await ctx.telegram.getFileLink(audioInfo.file_id);
            const messageInfo = await ctx.sendMessage(PROCESS_STATUS.START);
            ctx.session.media = {
                title: audioInfo.file_name ?? 'unknown title',
                path: `${ctx.session.userFolderPath}/${audioInfo.file_name}`,
            };
            const file = fs.createWriteStream(ctx.session!.media!.path!);

            https.get(audio.href, (resp) => {
                resp.pipe(file)
                    .on('error', async () => {
                        await ctx.sendMessage(PROCESS_STATUS.ERROR);
                        return;
                    });
            });

            file.on('finish', async () => {
                await ctx.deleteMessage(messageInfo.message_id);
                file.close();
                await replyToChanePinch(ctx);
            })
                .on('error', async () => {
                    await ctx.sendMessage(PROCESS_STATUS.ERROR);
                    return;
                });
        });

        this.bot.on(message('text'), async (ctx) => {
            if (!ctx.session?.userName) {
                await ctx.sendMessage('Для начала работы напишите комманду /start');
                return;
            }
            const userMessage = ctx.message.text;
            const urlData = await getUrlData(userMessage, ctx);

            if (isHostLink(urlData, 'instagram')) {
                let dataList;
                try {
                    dataList = await instagramDl(userMessage);
                } catch (error) {
                    await ctx.sendMessage(PROCESS_STATUS.ERROR);
                    return;
                }

                await downloadInstAudioAndSendToUser(
                    dataList[0].download_link,
                    ctx
                );
            }

            if (isHostLink(urlData, 'youtu')) {
                const info = await getYoutubeVideoInfo(userMessage, ctx);
                if (!info) return;
                ctx.session.media = {
                    title: info.videoDetails.title,
                    path: `${ctx.session?.userFolderPath}/${MESSAGE_TEXT.PERFORMER}_${info.videoDetails.title}.mp3`,
                    duration: info.videoDetails.lengthSeconds
                };

                await downloadYTAudioAndSendToUser(
                    userMessage,
                    ctx
                );
            }

            this.bot.action('back', async (ctx) => {
                await ctx.reply(MESSAGE_TEXT.WELCOME_MESSAGE);
                await ctx.answerCbQuery(MESSAGE_TEXT.THANKS_MESSAGE);
                await deleteUploadedAndChangedMedia(ctx.session!.userFolderPath);
            });

            for (const pitch of speedPitches) {
                this.bot.action(`x${pitch}`, async (ctx) => {
                    if (!ctx.session?.media?.path) {
                        await ctx.sendMessage(PROCESS_STATUS.ERROR_FILE_NOT_FOUND);
                        return;
                    }

                    await changePitch(pitch, ctx.session!.media!.path, ctx);
                    await ctx.answerCbQuery(PROCESS_STATUS.START);
                });
            }

        });

        const replyToChanePinch = async (ctx: Context) => {
            await ctx.reply(
                `Желаете замедлить аудио?`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('x0.5', 'x0.5'), Markup.button.callback('x0.6', 'x0.6')],
                    [Markup.button.callback('x0.7', 'x0.7'), Markup.button.callback('x0.75', 'x0.75')],
                    [Markup.button.callback('x0.8', 'x0.8'), Markup.button.callback('x0.85', 'x0.85')],
                    [{text: 'Удалить файлы', callback_data: 'back'}]
                ]),
            );
        };

        const downloadInstAudioAndSendToUser = async (
            downloadLink: string,
            ctx: IBotContext,
        ) => {
            ctx.session!.media = {
                title: 'instagram_music',
                path: `${ctx.session?.userFolderPath}/${MESSAGE_TEXT.PERFORMER}_instagram_music.mp4`
            };
            try {
                const messageInfo = await ctx.sendMessage(PROCESS_STATUS.START);
                const file = fs.createWriteStream(ctx.session!.media!.path!);

                https.get(downloadLink, (resp) => {
                    resp.pipe(file);
                });

                file.on('finish', () => {
                    const mediaPath = ctx.session!.media!.path!.replace('mp4', 'mp3');
                    file.close();
                    ffmpeg(ctx.session!.media!.path!)
                        .noVideo()
                        .output(mediaPath)
                        .on('end', async () => {
                            await ctx.telegram.editMessageText(
                                messageInfo.chat.id,
                                messageInfo.message_id,
                                undefined,
                                PROCESS_STATUS.SUCCESSES
                            );
                            await ctx.replyWithAudio({source: mediaPath}, {
                                title: ctx.session?.media?.title,
                                performer: MESSAGE_TEXT.PERFORMER,
                                caption: MESSAGE_TEXT.CAPTION,
                            });
                            await replyToChanePinch(ctx);
                        })
                        .on('error', async (error: string) => {
                            await ctx.sendMessage(PROCESS_STATUS.ERROR);
                            console.error(`Something went wrong: ${error}`);
                            return;
                        })
                        .run();
                });
            } catch (error) {
                await ctx.sendMessage(PROCESS_STATUS.ERROR);
                throw new Error(`Something went wrong: ${error}`);
            }
        };


        const getYoutubeVideoInfo = async (message: string, ctx: Context) => {
            try {
                return await ytdl.getInfo(message);
            } catch (error) {
                await ctx.sendMessage(PROCESS_STATUS.ERROR);
                return;
            }
        };

        const changePitch = async (pitch: string, mediaPath: string, ctx: IBotContext) => {
            const messageInfo = await ctx.sendMessage(PROCESS_STATUS.START);
            const pitchPath = `${ctx.session?.userFolderPath}/${MESSAGE_TEXT.PERFORMER}_x${pitch}.mp3`;

            ffmpeg(mediaPath)
                .output(pitchPath)
                .audioFilter([
                    {
                        filter: 'atempo',
                        options: parseFloat(pitch)
                    }
                ])
                .on('end', async () => {
                    await ctx.replyWithAudio({source: pitchPath}, {
                        title: ctx.session?.media?.title,
                        performer: `${MESSAGE_TEXT.PERFORMER}_x${pitch}`,
                        caption: MESSAGE_TEXT.CAPTION,
                    });
                    await ctx.telegram.deleteMessage(
                        messageInfo.chat.id,
                        messageInfo.message_id,
                    );
                })
                .on('error', async (error: string) => {
                    console.log(error);
                    await ctx.telegram.editMessageText(
                        messageInfo.chat.id,
                        messageInfo.message_id,
                        undefined,
                        PROCESS_STATUS.ERROR_FILE_NOT_FOUND
                    );
                    return;
                })
                .run();
        };

        const downloadYTAudioAndSendToUser = async (
            mediaUrl: string,
            ctx: IBotContext
        ) => {
            const messageInfo = await ctx.sendMessage(PROCESS_STATUS.START);

            ytdl(mediaUrl, {quality: 'highestaudio', filter: 'audioonly'})
                .pipe(fs.createWriteStream(ctx!.session!.media!.path!))
                .on('finish', async () => {
                    await ctx.replyWithAudio({source: ctx!.session!.media!.path!}, {
                        title: ctx.session?.media?.title,
                        performer: MESSAGE_TEXT.PERFORMER,
                        caption: MESSAGE_TEXT.CAPTION,
                        duration: parseInt(ctx!.session!.media!.duration!)
                    });
                    await ctx.telegram.editMessageText(
                        messageInfo.chat.id,
                        messageInfo.message_id,
                        undefined,
                        PROCESS_STATUS.SUCCESSES
                    );
                    await replyToChanePinch(ctx);
                })
                .on('error', async () => {
                    await ctx.telegram.editMessageText(
                        messageInfo.chat.id,
                        messageInfo.message_id,
                        undefined,
                        PROCESS_STATUS.ERROR
                    );
                });
        };
    }
}
