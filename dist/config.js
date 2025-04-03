"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.default = {
    server: {
        port: process.env.PORT || 3001,
        env: process.env.NODE_ENV || 'development'
    },
    database: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_KEY,
        pgUrl: process.env.DATABASE_URL
    },
    apis: {
        usitc: {
            baseUrl: process.env.USITC_API_URL || 'https://hts.usitc.gov/api'
        },
        ustr: {
            baseUrl: process.env.USTR_API_URL || 'https://ustr.gov/api'
        },
        cbp: {
            baseUrl: process.env.CBP_API_URL || 'https://www.cbp.gov/api'
        },
        federalRegister: {
            baseUrl: process.env.FED_REGISTER_API_URL || 'https://www.federalregister.gov/api/v1'
        }
    },
    sync: {
        concurrency: parseInt(process.env.SYNC_CONCURRENCY || '3', 10),
        retries: parseInt(process.env.SYNC_RETRIES || '3', 10),
        batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '100', 10)
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};
