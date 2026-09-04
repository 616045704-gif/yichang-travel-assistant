const gates = {
  integration: '开发云环境、服务和两个测试用户尚未接入（计划任务 08 起）。',
  e2e: '微信开发者工具与自动化端口尚未核验（需先完成导入）。',
  content: '首批已核验地点资料尚未导入（计划任务 09）。',
  release: '本项目仍为基础骨架，真实服务和真机验收尚未完成。',
};
console.error(`BLOCKED: ${gates[process.argv[2]] || '未知的平台检查。'}`);
process.exitCode = 2;
