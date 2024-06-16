import {Context} from "telegraf";

interface IUrlData {
    host?: string,
    url?: string,
    error?: boolean
}

export class UrlData implements IUrlData {
    public error: boolean;
    public host: string;
    public url: string;

    constructor(data: IUrlData) {
        this.host = data.host ?? '';
        this.url = data.url ?? '';
        this.error = data.error ?? false;
    }
}

export const getUrlData = async (url: string, ctx: Context): Promise<UrlData | void> => {
    try {
        const newUrl = new URL(url);
        return new UrlData({host: newUrl.host, url: newUrl.href});
    } catch (error) {
        await ctx.reply('Ссылка на ютуб не валидная. Проверьте, пожалуйста, отправленную ссылку и отправьте ещё раз.');
    }
};

export const isHostLink = (data: UrlData | void, host: string) => {
    return data instanceof UrlData && data.host.includes(host);
};