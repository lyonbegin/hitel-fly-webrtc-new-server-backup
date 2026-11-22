"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true });
    const config = app.get(config_1.ConfigService);
    const origins = (config.get('CORS_ORIGINS') ?? '*')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    app.enableCors({
        origin: origins.includes('*') ? true : origins,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableShutdownHooks();
    const port = Number(config.get('PORT') ?? 8080);
    await app.listen(port, '0.0.0.0');
    console.log(`Realtime server listening on :${port}`);
}
bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map