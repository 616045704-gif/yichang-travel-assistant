import { createPlaceRepository } from '../places/repository';
import { handlePlaceRequest } from '../places/service';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event: Record<string, unknown>) => handlePlaceRequest(event, { repository: createPlaceRepository(cloud.database()), storage: cloud });
