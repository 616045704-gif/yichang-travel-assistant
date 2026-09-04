import { createPlaceRepository } from '../places/repository';
import { handlePlaceRequest } from '../places/service';
import { createUserRepository } from '../users/repository';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event: Record<string, unknown>) => {
  const database = cloud.database();
  const context = cloud.getWXContext();
  const ownerId = typeof context.OPENID === 'string' && context.OPENID ? context.OPENID : null;
  const userRepository = createUserRepository(database);
  return handlePlaceRequest(event, {
    repository: createPlaceRepository(database), storage: cloud,
    favoritePlaceIds: ownerId ? placeIds => userRepository.favoritePlaceIds(ownerId, placeIds) : undefined,
  });
};
