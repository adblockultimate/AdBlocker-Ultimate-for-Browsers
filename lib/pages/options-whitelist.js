const WhiteListRules = function (params) {
    'use strict';
	
	const { pageController } = params;
	
	const editor = ace.edit('whiteListRules');
    editor.$blockScrolling = Infinity;
    editor.setShowPrintMargin(false);
	editor.focus();
	
	const editorHandler = new EditorHandler({
        editor,
        saveEventType: 'clearAndAddWhiteListDomains',
        statusContainer: $('#whitelistRulesStatus'),
		pageController: pageController
    });

    const importBtn = $('#whiteListImportImport');
    const importWhiteListInput = $('#importWhiteListInput');
    const exportBtn = $('#exportWhitelistBtn');

    let hasRules = false;
    function loadWhiteListDomains() {
        contentPage.sendMessage({
            type: 'getWhiteListDomains',
        }, (data) => {
            hasRules = (!!data.rules && data.rules.length > 0);
			let rulesTxt = '';
			if(hasRules) { 
				for(let i = 0, c = data.rules.length; i < c; i++){
					rulesTxt += data.rules[i] + "\n";
				}
				exportBtn.removeClass('disabled');
            }
			if (editor.getValue() !== rulesTxt) {
				editor.setValue(rulesTxt || '', 1);
			}
        });
    }

    function updateWhiteListDomains() {
        if (editorHandler.canUpdate()) {
            loadWhiteListDomains();
        }
    }

    const session = editor.getSession();
    let isChanged = false;
	
    session.on('change', () => {
        if (session.getValue().length > 0) {
            exportBtn.removeClass('disabled');
        } else {
            exportBtn.addClass('disabled');
        }

        if (!isChanged && hasRules) {
            isChanged = true;
            return;
        }
        editorHandler.typing();
    });
    
	exportBtn.on('click', (e) => {
        e.preventDefault();
        if($(this).hasClass('disabled')) return false;
        contentPage.sendMessage({type: 'openExportRulesTab', whitelist: true});
		return false;
    });

    importBtn.on('click', (e) => {
        importWhiteListInput.click();
        e.preventDefault();
		return false;
    });

    importWhiteListInput.on('change', (e) => {
        var fileInput = e.target;
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                importWhiteListFilterRules(e.target.result);
            } catch (e) {
				pageController.showError(i18n.getMessage('options_err_import_file'));
            }
            fileInput.value = '';
        };
		
        reader.onerror = function (data) {
			pageController.showError(i18n.getMessage('options_err_import_file'));
            fileInput.value = '';
        };
        var file = fileInput.files[0];
        if (file) {
			let ext = file.name.split('.').pop().toLowerCase();
			if(ext != 'txt'){ 
				pageController.showError(i18n.getMessage('options_err_no_txt_file'));
				return false;
			}
            reader.readAsText(file, "utf-8");
        }
    });
	
	const importWhiteListFilterRules = function(text) {
        var domains = text ? text.split(/[\r\n]+/) : [];
        contentPage.sendMessage({type: 'addWhiteListDomains', domains: domains});
    }
	
	$('.focus_whitelist').on('click', () => {
		editor.focus();
	});

    return {
        updateWhiteListDomains,
    };
};