"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Testrunner = void 0;
const testrunner_1 = __importDefault(require("./testrunner/testrunner"));
exports.Testrunner = testrunner_1.default;
var logger_1 = require("../src/logging/logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
