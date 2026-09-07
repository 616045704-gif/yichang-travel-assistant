Component({
  properties: {
    visible: { type: Boolean, value: false },
    tone: { type: String, value: 'info' },
    message: { type: String, value: '' },
  },
  methods: {
    dismiss() { this.triggerEvent('dismiss'); },
  },
});
