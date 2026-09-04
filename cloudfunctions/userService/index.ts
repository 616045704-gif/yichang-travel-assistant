import { createRequire } from 'node:module';
import { createUserRepository } from '../users/repository';
import { handleUserRequest } from '../users/service';

const require = createRequire(import.meta.url);
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event: Record<string, unknown>) => {
  const context = cloud.getWXContext();
  return handleUserRequest(event, { ownerId: typeof context.OPENID === 'string' && context.OPENID ? context.OPENID : null, repository: createUserRepository(cloud.database()) });
};
