Component({
  properties: {
    status: { type: String, value: 'empty' },
    title: { type: String, value: '暂时没有内容' },
    message: { type: String, value: '' },
    retryText: { type: String, value: '重试' },
  },
  methods: {
    onRetry() { if (this.data.status === 'error') this.triggerEvent('retry'); },
  },
});
