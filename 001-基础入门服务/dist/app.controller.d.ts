import { AppService } from './app.service';
export declare class AppController {
    private readonly app;
    constructor(app: AppService);
    getHello(): {
        message: string;
        demo: string;
        no: number;
    };
    getInfo(): {
        name: string;
        framework: string;
        version: string;
    };
}
