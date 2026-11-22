"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
function validateEnv(raw) {
    const env = { ...raw };
    const production = env.NODE_ENV === 'production';
    if (production) {
        const required = ['JWT_SECRET', 'MEDIASOUP_ANNOUNCED_ADDRESS', 'CORS_ORIGINS'];
        for (const key of required) {
            if (!env[key])
                throw new Error(`${key} is required in production`);
        }
        const testLoginEnabled = (env.TEST_LOGIN_ENABLED ?? 'false').toLowerCase() === 'true';
        if (testLoginEnabled && !env.TEST_LOGIN_KEY) {
            throw new Error('TEST_LOGIN_KEY is required when TEST_LOGIN_ENABLED=true');
        }
    }
    const workers = positiveInt(env.MEDIASOUP_WORKERS, 2, 'MEDIASOUP_WORKERS');
    const maxWorkers = positiveInt(env.MEDIASOUP_MAX_WORKERS, 4, 'MEDIASOUP_MAX_WORKERS');
    if (workers > maxWorkers)
        throw new Error('MEDIASOUP_WORKERS cannot exceed MEDIASOUP_MAX_WORKERS');
    positiveInt(env.MEDIASOUP_WEBRTC_PORT_BASE, 40000, 'MEDIASOUP_WEBRTC_PORT_BASE');
    positiveInt(env.PORT, 8080, 'PORT');
    return raw;
}
function positiveInt(value, fallback, name) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0)
        throw new Error(`${name} must be a positive integer`);
    return parsed;
}
//# sourceMappingURL=env.validation.js.map