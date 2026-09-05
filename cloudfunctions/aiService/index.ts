import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createDifyClient } from '../ai/dify';
import { createAiConversationRepository } from '../ai/repository';
import { createLocalFactRetriever } from '../ai/retrieval';
import { createAiRecordRepository } from '../ai/records';
import { handleAiRequest } from '../ai/service';

const require = createRequire(import.meta.url);
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function difyUser(ownerId: string) {
  return createHash('sha256').update(`dify-user\u0000${ownerId}`).digest('hex');
}

exports.main = async (event: Record<string, unknown>) => {
  const context = cloud.getWXContext();
  const ownerId = typeof context.OPENID === 'string' && context.OPENID ? context.OPENID : null;
  const database = cloud.database();
  return handleAiRequest(event, {
    ownerId, user: ownerId ? difyUser(ownerId) : '', repository: createAiConversationRepository(database), records: createAiRecordRepository(database),
    retrieve: createLocalFactRetriever(database), dify: createDifyClient(process.env),
  });
};
