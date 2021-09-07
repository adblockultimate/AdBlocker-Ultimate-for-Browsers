const CustomRules = function (params) {
    'use strict';
	
	const { pageController } = params;

    const editor = ace.edit('customRulesEditor');
    editor.$blockScrolling = Infinity;
    editor.setShowPrintMargin(false);
	editor.focus();
	
    const editorHandler = new EditorHandler({
        editor,
        saveEventType: 'clearAndAddUserFilterRules',
        statusContainer: $('#customRulesStatus'),
    });
	
    const importCustomFiltersInput = $('#importUserFilterInput');
    const importBtn = $('#customFiltersImport');
    const exportBtn = $('#customFiltersExport');
	const session = editor.getSession();

    let hasRules = false;
    function loadCustomRules() {
        contentPage.sendMessage({
            type: 'getUserFilters',
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
	
    function updateCustomRules() {
		if (editorHandler.canUpdate()) {
			loadCustomRules();
		}
    }

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

    importBtn.on('click', (e) => {
        e.preventDefault();
        importCustomFiltersInput.click();
		return false;
    });

    importCustomFiltersInput.on('change', (e) => {
        var fileInput = e.target;
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                importCustomRules(e.target.result);
            } catch (e) {
				pageController.showError(i18n.getMessage('options_err_import_file'));
            }
            fileInput.value = '';
        };
		
        reader.onerror = function (data) {
            fileInput.value = '';
			pageController.showError(i18n.getMessage('options_err_import_file'));
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
	
	const importCustomRules = function(text) {
        var rules = text ? text.split(/[\r\n]+/) : [];
        contentPage.sendMessage({type: 'addUserFilterRules', rules: rules});
    }

    exportBtn.on('click',function(e){
		e.preventDefault();
        if($(this).hasClass('disabled')) return false;
        contentPage.sendMessage({type: 'openExportRulesTab', whitelist: false});
		return false;
    });
	
	$('.focus_custom_rules').on('click', () => {
		editor.focus();
	});

    return {
        updateCustomRules,
    };
};
