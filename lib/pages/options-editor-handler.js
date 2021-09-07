const EditorHandler = function (options) {
    this.statusContainer = options.statusContainer;
    this.editor = options.editor;
    this.saveEventType = options.saveEventType;

    const STATUS_CLEAR = 0;
    const STATUS_TYPING = 1;
    const STATUS_SAVED = 2;

	var timeout;

    this.manageState = function (status) {
		this.currentStatus = status;
        if (timeout) {
            clearTimeout(timeout);
        }
		
        const self = this;
		this.updateStatusContainer(STATUS_TYPING);
		timeout = setTimeout(() => {
			self.saveRules();
			this.updateStatusContainer(STATUS_SAVED);
			timeout = setTimeout(() => {	/* hide saved txt after 1.5s */
				this.currentStatus = STATUS_CLEAR;
				self.updateStatusContainer(STATUS_CLEAR);
			}, 1500);
		}, 1000);
    };
	
	
    this.updateStatusContainer = function (status) {
        switch (status) {
            case STATUS_SAVED:
				this.statusContainer.text(i18n.getMessage('options_status_saved'));
                break;
            case STATUS_TYPING:
            default:
				this.statusContainer.text('');
                break;
        }
    };

    this.saveRules = function () {
        const text = this.editor.getValue();
		let rules = (text.length > 0) ? text.split(/\n/) : [];
        contentPage.sendMessage({
            type: this.saveEventType,
            rules: rules,
        }, () => {});
    };

    const typing = () => {
        this.manageState(STATUS_TYPING);
    };

    const canUpdate = () => (this.currentStatus != STATUS_TYPING);

    return {
        canUpdate,
        typing
    };
};
