import {ConfigService} from "./config/config.service";
import {IConfigService} from "./config/config.interface";
import {session, Telegraf} from "telegraf";
import {IBotContext} from "./context/context.interface";
import {Command} from "./commands/command.class";
import {StartCommand} from "./commands/start.command";
import * as fs from 'fs';

export const ROOT_MEDIA_PATH = './media';

class Bot {
    bot: Telegraf<IBotContext>;
    commands: Command[] = [];

    constructor(private readonly configService: IConfigService) {
        this.bot = new Telegraf<IBotContext>(this.configService.get('TG_TOKEN'));
        this.bot.use(session());
    }

    init() {
        if (!fs.existsSync(ROOT_MEDIA_PATH)) {
            fs.mkdirSync(ROOT_MEDIA_PATH);
        }

        this.commands = [
            new StartCommand(this.bot),
        ];

        for (const command of this.commands) {
            command.handle();
        }
        this.bot.start((ctx) => {
            ctx.reply('Добро пожаловать!\nОтправьте ссылку на Ютуб или Инстаграм.\nТакже можете отправить МР3 файл.');
        });

        this.bot.launch();

        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
}

const bot = new Bot(new ConfigService());
bot.init();

