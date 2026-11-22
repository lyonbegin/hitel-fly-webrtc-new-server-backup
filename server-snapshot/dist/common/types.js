"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fail = exports.ok = void 0;
const ok = (data) => ({ ok: true, data });
exports.ok = ok;
const fail = (code, message, details) => ({
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
});
exports.fail = fail;
//# sourceMappingURL=types.js.map