/*
 * Lua-style "Save & Apply" for the 25.12 client-side views.
 *
 * The stock ucode view framework reports apply progress and success through
 * a modal dialog and presents "Save & Apply" as a combo dropdown.  The Lua
 * LuCI versions of these themes submitted the form and showed a page-wide
 * loading overlay instead.  Keep the apply logic but restore that behaviour.
 */
(function () {
	'use strict';

	function contentText(content) {
		if (!content)
			return '';

		if (typeof content === 'string')
			return content;

		if (content.nodeType)
			return content.textContent || '';

		if (Array.isArray(content))
			return content.map(contentText).join(' ');

		return content.textContent || '';
	}

	function statusBox() {
		var host = document.getElementById('view') || document.getElementById('maincontent');

		if (!host)
			return null;

		var el = document.getElementById('theme-apply-status');

		if (!el) {
			el = document.createElement('div');
			el.id = 'theme-apply-status';
			host.insertBefore(el, host.firstChild);
		}

		return el;
	}

	function removeStatus() {
		var el = document.getElementById('theme-apply-status');

		if (el && el.parentNode)
			el.parentNode.removeChild(el);
	}

	function showStatus(type, content) {
		var box = statusBox();

		if (!box)
			return;

		var spinning = String(type || '').indexOf('spinning') !== -1;
		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;
		var text = contentText(content);

		if (spinning) {
			box.className = 'theme-apply-status show spinning';
			box.innerHTML = '<span class="theme-apply-spinner"></span><span>' +
				(zh ? '正在应用更改…' : 'Applying configuration changes…') + '</span>';
			return;
		}

		var label;

		if (/no changes|没有.*更改|无更改/i.test(text))
			label = zh ? '没有需要应用的更改' : 'There are no changes to apply';
		else if (/revert|回退|还原/i.test(text))
			label = zh ? '配置已回退' : 'Configuration changes reverted';
		else
			label = zh ? '配置已应用' : 'Configuration changes applied';

		box.className = 'theme-apply-status show success';
		box.innerHTML = '<span class="theme-apply-check">✓</span><span>' + label + '</span>';
	}

	function removeApplyFieldset() {
		var old = document.getElementById('theme-apply-fieldset');

		if (old && old.parentNode)
			old.parentNode.removeChild(old);
	}

	function showLuaApply() {
		var existing = document.getElementById('theme-apply-fieldset');

		if (existing && existing.style.display !== 'none')
			return;

		removeApplyFieldset();

		var view = document.querySelector('body.theme-network-page #modal_overlay .modal') ||
		           document.getElementById('view') ||
		           document.querySelector('#maincontent .container') ||
		           document.getElementById('maincontent');

		if (!view)
			return;

		var box = document.createElement('fieldset');
		var legend = document.createElement('legend');
		var title = document.createElement('span');
		var img = document.createElement('img');
		var text = document.createElement('span');

		box.id = 'theme-apply-fieldset';
		box.className = 'cbi-section theme-apply-lua';
		legend.textContent = '正在应用更改';
		title.className = 'panel-title';
		title.textContent = '正在应用更改';
		img.src = '/luci-static/resources/icons/loading.gif';
		img.alt = '';
		img.className = 'theme-apply-loading';
		text.id = 'theme-apply-lua-status';
		text.textContent = '正在应用更改…';
		box.appendChild(legend);
		box.appendChild(title);
		box.appendChild(img);
		box.appendChild(text);

		var h2 = view.querySelector('h2');

		if (h2 && h2.parentNode === view)
			view.insertBefore(box, h2.nextSibling);
		else
			view.insertBefore(box, view.firstChild);

		/* The Lua page reloads at the top, so the apply block is visible.
		 * The JS page keeps the scroll position; move it into view. */
		var overlay = document.getElementById('modal_overlay');

		if (overlay)
			overlay.scrollTop = 0;
		else
			window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function finishLuaApply(content) {
		var box = document.getElementById('theme-apply-fieldset');
		var text = document.getElementById('theme-apply-lua-status');

		if (!box) {
			showLuaApply();
			box = document.getElementById('theme-apply-fieldset');
			text = document.getElementById('theme-apply-lua-status');
		}

		if (!box || !text)
			return;

		var raw = contentText(content);
		var label = '配置已应用。';

		if (/no changes|没有.*更改|无更改/i.test(raw))
			label = '没有需要应用的更改。';
		else if (/revert|回退|还原/i.test(raw))
			label = '配置已回退。';

		text.textContent = label;

		var img = box.querySelector('.theme-apply-loading');
		if (img && img.parentNode)
			img.parentNode.removeChild(img);

		window.setTimeout(function () {
			if (box.parentNode)
				box.style.display = 'none';
		}, 1500);
	}

	function failLuaApply(label) {
		var box = document.getElementById('theme-apply-fieldset');
		var text = document.getElementById('theme-apply-lua-status');

		if (!box) {
			showLuaApply();
			box = document.getElementById('theme-apply-fieldset');
			text = document.getElementById('theme-apply-lua-status');
		}

		if (!box || !text)
			return;

		box.classList.add('theme-apply-error');
		text.textContent = label;

		var img = box.querySelector('.theme-apply-loading');
		if (img && img.parentNode)
			img.parentNode.removeChild(img);
	}

	function patchStatus() {
		if (!window.L || !L.ui || !L.ui.changes)
			return false;

		var changes = L.ui.changes;
		var proto = Object.getPrototypeOf(changes);

		if (!proto || typeof proto.displayStatus !== 'function')
			return false;

		if (changes.__themeApplyPatched)
			return true;

		var original = proto.displayStatus;

		function themeDisplayStatus(type, content) {
			var kind = String(type || '');

			if (!type) {
				removeApplyFieldset();
				return original.call(this, type, content);
			}

			if (kind.indexOf('spinning') !== -1) {
				showLuaApply();
				return;
			}

			if (kind === 'notice') {
				if (String(contentText(content) || '').trim())
					finishLuaApply(content);
				return;
			}

			/* Errors and connectivity warnings still need their dialog. */
			removeApplyFieldset();
			return original.call(this, type, content);
		}

		changes.__themeApplyPatched = true;

		if (!changes.__themeIndicatorPatched) {
			var originalIndicator = changes.setIndicator;

			changes.setIndicator = function (count) {
				if (count === 0 && document.getElementById('theme-apply-fieldset'))
					finishLuaApply('配置已应用。');

				return originalIndicator.apply(this, arguments);
			};

			changes.__themeIndicatorPatched = true;
		}

		/* Core calls both `this.displayStatus(...)` and
		 * `UI.prototype.changes.displayStatus(...)`, so patch both the
		 * singleton and its prototype. */
		changes.displayStatus = themeDisplayStatus;

		try {
			proto.displayStatus = themeDisplayStatus;
		} catch (e) {
			/* Some baseclass prototypes are not writable; the singleton
			 * property above is the one the apply code actually calls. */
		}

		return true;
	}

	function patchShowModal() {
		if (!window.L || !L.ui)
			return false;

		var proto = Object.getPrototypeOf(L.ui);

		if (!proto || typeof proto.showModal !== 'function')
			return false;

		if (proto.__themeShowModalPatched)
			return true;

		var original = proto.showModal;

		proto.showModal = function (title, children) {
			/* displayStatus() creates its apply notice through
			 * showModal('', '').  Return a detached node so the core can
			 * finish the apply without painting a modal or a backdrop. */
			if (!title && (children === '' || children == null))
				return document.createElement('div');

			return original.apply(this, arguments);
		};

		proto.__themeShowModalPatched = true;
		return true;
	}

	function suppressApplyModal() {
		var modal = document.querySelector('#modal_overlay .modal.alert-message.notice, #modal_overlay .modal.alert-message.spinning');

		if (!modal)
			return;

		var text = String(modal.textContent || '');

		if (/配置已应用|Configuration changes applied/i.test(text) && !window.__themeApplyReload) {
			window.__themeApplyReload = true;
			window.setTimeout(function () {
				window.location.reload();
			}, 300);
		}

		var text = String(modal.textContent || '');

		if (/配置已应用|Configuration changes applied|没有需要|no changes|配置已回退|reverted/i.test(text)) {
			finishLuaApply(text);
		}
		else if (/(notice|spinning)/.test(modal.className)) {
			showLuaApply();
		}

		/* The apply notice is the only modal LuCI draws for a plain
		 * Save & Apply.  Remove it and its backdrop; the apply request
		 * itself keeps running in the background. */
		modal.innerHTML = '';
		document.body.classList.remove('modal-overlay-active');
	}

	function makeApplyButton() {
		var btn = document.createElement('button');
		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;

		btn.type = 'button';
		btn.className = 'cbi-button cbi-button-apply important';
		btn.textContent = zh ? '保存并应用' : 'Save & Apply';
		return btn;
	}

	function patchActions() {
		var combo = document.querySelector('#view .cbi-page-actions .cbi-dropdown.btn, #maincontent .cbi-page-actions .cbi-dropdown.btn');

		if (!combo || combo.__themeApplyReplaced)
			return;

		combo.__themeApplyReplaced = true;

		var btn = makeApplyButton();

		btn.addEventListener('click', function (ev) {
			ev.preventDefault();

			var item = combo.querySelector('ul.dropdown > li[data-value="0"]');

			if (item)
				item.click();
			else
				combo.click();

		});

		combo.parentNode.insertBefore(btn, combo);
		combo.style.setProperty('display', 'none', 'important');
	}

	/*
	 * The 25.12 process/startup tables pack all row actions into one cell,
	 * while the Lua themes render one action per column.  Split them so the
	 * layout and the button styles match the Lua pages.
	 */
	function splitActionTable(table, labels, classes, kind) {
		var head = table.querySelector('tr.table-titles, tr.cbi-section-table-titles');

		if (!head)
			return;

		/* The Lua process/startup tables were not sortable.  Sorting also
		 * rebuilds the row from the core model and drops the split action
		 * columns, so disable it for these two tables. */
		if (!table.__themeNoSort) {
			table.addEventListener('click', function (ev) {
				var th = ev.target && ev.target.closest ? ev.target.closest('th') : null;

				if (th) {
					ev.preventDefault();
					ev.stopImmediatePropagation();
				}
			}, true);

			table.__themeNoSort = true;
		}

		if (!head.__themeActionHead || head.children.length < labels.length + 2) {
			var headCells = Array.prototype.slice.call(head.children);
			var lastHead = headCells[headCells.length - 1];

			if (lastHead && !String(lastHead.textContent || '').trim())
				lastHead.parentNode.removeChild(lastHead);

			for (var i = 0; i < labels.length; i++) {
				var th = document.createElement('th');

				th.className = 'th center nowrap theme-action-head';
				th.textContent = labels[i];
				head.appendChild(th);
			}

			head.__themeActionHead = true;
		}

		var rows = table.querySelectorAll('tr');

		table.querySelectorAll('th[data-sortable-row]').forEach(function (th) {
			th.removeAttribute('data-sortable-row');
		});

		for (var r = 0; r < rows.length; r++) {
			var row = rows[r];

			if (row === head || row.__themeActions)
				continue;

			var cells = Array.prototype.slice.call(row.children);
			var action = cells[cells.length - 1];

			if (!action || !action.classList.contains('cbi-section-actions'))
				continue;

			var buttons = Array.prototype.slice.call(action.querySelectorAll('button'));

			if (!buttons.length)
				continue;

			action.parentNode.removeChild(action);

			for (var b = 0; b < labels.length; b++) {
				var td = document.createElement('td');
				var btn = buttons[b];

				td.className = 'td center nowrap cbi-section-actions theme-action-cell';
				td.setAttribute('data-title', labels[b]);

				if (btn) {
					if (classes[b]) {
						classes[b].split(/\s+/).forEach(function (name) {
							if (name)
								btn.classList.add(name);
						});
					}

					if (kind === 'startup' && b === 0) {
						var state = String(btn.textContent || '').trim();

						if (state === '已启用')
							btn.textContent = '禁用';
						else if (state === '已禁用')
							btn.textContent = '启用';
						else if (state === 'Enabled')
							btn.textContent = 'Disable';
						else if (state === 'Disabled')
							btn.textContent = 'Enable';
					}
					else if (kind === 'startup' && b === 4) {
						btn.textContent = '停用客户端';
					}

					td.appendChild(btn);
				}

				row.appendChild(td);
			}

			row.__themeActions = true;
		}
	}

	function adaptProcesses() {
		if (!document.body.classList.contains('node-status-processes'))
			return;

		var table = document.querySelector('#view table');

		if (table) {
			splitActionTable(table,
				['挂起', '关闭', '强制关闭'],
				['cbi-button cbi-input-reload', 'cbi-button cbi-input-remove', 'cbi-button cbi-input-reset'],
				'process');
		}
	}

	function adaptStartup() {
		if (!document.body.classList.contains('node-system-startup'))
			return;

		var table = document.querySelector('#view table');

		if (table) {
			splitActionTable(table,
				['启用/禁用', '启动', '重启', '重新加载', '停用客户端'],
				['cbi-button cbi-input-save', 'cbi-button cbi-input-apply', 'cbi-button cbi-input-reload',
				 'cbi-button cbi-input-reload', 'cbi-button cbi-input-remove'],
				'startup');
		}
	}

	function adaptPackages() {
		if (!document.body.classList.contains('node-system-package-manager'))
			return;

		var menu = document.querySelector('#view .cbi-tabmenu.mode');

		if (menu && !menu.__themeOrdered) {
			var installed = menu.querySelector('li[data-mode="installed"]');
			var available = menu.querySelector('li[data-mode="available"]');
			var updates = menu.querySelector('li[data-mode="updates"]');

			if (installed)
				menu.appendChild(installed);
			if (available)
				menu.appendChild(available);
			if (updates)
				menu.appendChild(updates);

			menu.__themeOrdered = true;
		}

		var table = document.querySelector('#view #packages');

		document.querySelectorAll('#view > .controls .btn').forEach(function (btn) {
			btn.classList.add('cbi-button');
		});

		var disk = document.querySelector('#view .controls .cbi-progressbar');

		if (disk) {
			var caption = disk.parentNode.querySelector('.theme-disk-caption');

			if (!caption) {
				caption = document.createElement('div');
				caption.className = 'theme-disk-caption';
				disk.parentNode.appendChild(caption);
			}

			var text = disk.getAttribute('title') || '';

			if (caption.textContent !== text)
				caption.textContent = text;

			disk.classList.add('theme-disk-bar');
		}

		if (!table)
			return;

		var head = table.querySelector('tr.table-titles, tr.cbi-section-table-titles');

		table.querySelectorAll('tr.placeholder td').forEach(function (td) {
			td.classList.add('theme-empty-cell');
		});

		if (head) {
			var last = head.lastElementChild;

			if (last && !String(last.textContent || '').trim())
				last.textContent = '操作';

			head.__themePackageHead = true;
		}

		var rows = table.querySelectorAll('tr');

		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];

			if (row === head)
				continue;

			var action = row.querySelector('td.cbi-section-actions');

			if (!action)
				continue;

			action.classList.add('theme-package-action');
			action.setAttribute('data-title', '操作');

			var control = action.querySelector('.btn, button');

			if (control) {
				var label = String(control.textContent || '').trim();

				if (label.indexOf('移除') === 0) {
					control.classList.add('theme-remove-link');

					if (control.textContent !== '移除')
						control.textContent = '移除';
				}
				else {
					control.classList.remove('theme-remove-link');
				}
			}
		}
	}

	function adaptDynlists() {
		document.querySelectorAll('#view .cbi-dynlist > .item, #modal_overlay .cbi-dynlist > .item').forEach(function (item) {
			if (item.querySelector('.theme-dyn-item-input'))
				return;

			var span = item.querySelector('span');
			var hidden = item.querySelector('input[type="hidden"]');

			if (!span || !hidden)
				return;

			var input = document.createElement('input');

			input.type = 'text';
			input.className = 'cbi-input-text theme-dyn-item-input';
			input.value = hidden.value || span.textContent || '';
			input.title = input.value;
			input.addEventListener('input', function () {
				hidden.value = input.value;
				item.dispatchEvent(new Event('change', { bubbles: true }));
			});

			span.parentNode.replaceChild(input, span);
		});
	}

	function adaptFileUploads() {
		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;
		var browseLabel = zh ? '选择文件…' : 'Select file…';

		document.querySelectorAll('#view .open-file-browser, #modal_overlay .open-file-browser').forEach(function (btn) {
			if (btn.classList.contains('theme-file-browse')) {
				var oldRow = btn.closest('.theme-file-upload-row');

				if (oldRow) {
					var host = oldRow.parentNode;
					var oldInput = oldRow.querySelector('.theme-file-path');

					if (oldInput)
						host.insertBefore(oldInput, oldRow);
					host.insertBefore(btn, oldRow);
					host.removeChild(oldRow);
					host.classList.add('theme-file-upload-host');
				}

				var parent = btn.parentNode;
				var input = parent.querySelector('.theme-file-path');
				var hiddenInput = parent.lastElementChild &&
					parent.lastElementChild.matches('input[type="hidden"]') ? parent.lastElementChild : null;
				var current = String(btn.textContent || '').trim();

				/* Keep the original ordering contract used by the core:
				 * first child = open button, next sibling = filebrowser,
				 * last child = hidden value.  The visible path input is
				 * reordered with CSS instead of breaking those lookups. */
				if (input && hiddenInput && input.nextElementSibling !== hiddenInput)
					parent.insertBefore(input, hiddenInput);

				if (input && hiddenInput && !hiddenInput.value) {
					if (input.value) {
						input.value = '';
						input.title = '';
					}
				}
				else if (input && hiddenInput && hiddenInput.value && !input.value) {
					input.value = hiddenInput.value;
					input.title = hiddenInput.value;
				}

				if (input && current && current !== browseLabel && current !== input.value) {
					input.value = current;
					input.title = current;
				}

				btn.querySelectorAll('img').forEach(function (img) {
					if (img.parentNode)
						img.parentNode.removeChild(img);
				});

				if (btn.textContent !== browseLabel)
					btn.textContent = browseLabel;

				return;
			}

			var label = String(btn.textContent || '').trim();

			if (!label)
				return;

			var host = btn.parentNode;
			var input = document.createElement('input');
			var hiddenInput = host.lastElementChild &&
				host.lastElementChild.matches('input[type="hidden"]') ? host.lastElementChild : null;

			input.type = 'text';
			input.readOnly = true;
			input.className = 'cbi-input-text theme-file-path';
			input.value = label;
			input.title = label;
			if (hiddenInput)
				host.insertBefore(input, hiddenInput);
			else
				host.appendChild(input);
			host.classList.add('theme-file-upload-host');
			btn.classList.add('theme-file-browse');
			btn.textContent = '';
			btn.appendChild(document.createTextNode(browseLabel));
		});
	}

	function adaptCrontabHelp() {
		if (!document.body.classList.contains('node-system-crontab') ||
		    document.getElementById('theme-cron-help'))
			return;

		var view = document.getElementById('view');

		if (!view)
			return;

		var help = document.createElement('div');
		var heading = document.createElement('h3');
		var format = document.createElement('p');
		var desc = document.createElement('p');
		var examples = document.createElement('p');
		var code = document.createElement('code');

		help.id = 'theme-cron-help';
		help.className = 'cbi-section theme-cron-help';
		heading.textContent = 'Crontab 使用说明';
		format.innerHTML = '格式：<code>分 时 日 月 周 命令</code>';
		desc.innerHTML = '范围：分 0-59，时 0-23，日 1-31，月 1-12，周 0-7（0 和 7 都表示周日）。' +
			'<br>通配符：<code>*</code> 任意，<code>*/5</code> 每 5 个单位，' +
			'<code>1,15</code> 列表，<code>1-5</code> 范围。';
		examples.innerHTML = '示例：<br>' +
			'<code>*/5 * * * * /usr/bin/task.sh</code> 每 5 分钟执行一次<br>' +
			'<code>0 2 * * * /usr/bin/backup.sh &gt;&gt; /tmp/backup.log 2&gt;&amp;1</code> 每天 02:00 执行并记录日志<br>' +
			'<code>0 8 * * 1-5 /usr/bin/work.sh</code> 工作日 08:00 执行<br>' +
			'<code>@reboot /usr/bin/start.sh</code> 开机后执行';
		code.textContent = '';
		help.appendChild(heading);
		help.appendChild(format);
		help.appendChild(desc);
		help.appendChild(examples);

		var descr = view.querySelector('.cbi-map-descr');
		var textarea = view.querySelector('textarea');
		var anchor = descr || textarea;

		if (anchor && anchor.parentNode)
			anchor.parentNode.insertBefore(help, anchor.nextSibling);
		else
			view.insertBefore(help, view.firstChild);
	}

	function adaptDiagnostics() {
		if (!document.body.classList.contains('node-network-diagnostics'))
			return;

		document.querySelectorAll('#view table.table td.td.left').forEach(function (td) {
			if (!td.__themeDiagRow) {
				var row = document.createElement('div');

				row.className = 'theme-diag-row';
				while (td.firstChild)
					row.appendChild(td.firstChild);
				td.appendChild(row);
				td.__themeDiagRow = true;
			}

			td.querySelectorAll('.diag-action > .cbi-dropdown').forEach(function (dd) {
				if (dd.__themeDiagConverted)
					return;

				var items = Array.prototype.slice.call(dd.querySelectorAll('li[data-value]'));

				if (!items.length)
					return;

				var wrap = document.createElement('div');
				var picker = document.createElement('button');
				var menu = document.createElement('div');
				var run = document.createElement('button');
				var selected = items.filter(function (li) {
					return li.hasAttribute('selected');
				})[0] || items[0];
				var base = String(selected.getAttribute('data-value') || 'ping').replace(/6$/, '');
				var currentValue = selected.getAttribute('data-value');
				var labelFor = function (li) {
					return String(li.textContent || '').trim().replace(/\s+(Ping|Traceroute)$/i, '');
				};

				wrap.className = 'theme-diag-select-wrap';
				picker.type = 'button';
				picker.className = 'theme-diag-select';
				picker.textContent = labelFor(selected);
				picker.title = labelFor(selected);
				picker.setAttribute('aria-haspopup', 'listbox');
				menu.className = 'theme-diag-menu';
				menu.hidden = true;
				items.forEach(function (li) {
					var option = document.createElement('button');
					var text = labelFor(li);

					option.type = 'button';
					option.className = 'theme-diag-option';
					option.dataset.value = li.getAttribute('data-value');
					option.textContent = text || li.getAttribute('data-value');
					option.classList.toggle('selected', li === selected);
					option.addEventListener('click', function (ev) {
						ev.preventDefault();
						ev.stopPropagation();
						setCommand(option.dataset.value);
						picker.textContent = option.textContent;
						picker.title = option.textContent;
						menu.hidden = true;
					});
					menu.appendChild(option);
				});
				wrap.appendChild(picker);
				wrap.appendChild(menu);

				var setCommand = function (value) {
					items.forEach(function (li) {
						li.removeAttribute('selected');
						li.removeAttribute('display');
					});
					var target = items.filter(function (li) {
						return li.getAttribute('data-value') === value;
					})[0];
					if (target) {
						target.setAttribute('selected', '');
						target.setAttribute('display', '0');
					}
					var hidden = dd.querySelector('input[type="hidden"]');
					if (hidden)
						hidden.value = value;
					dd.value = value;
					currentValue = value;
					menu.querySelectorAll('.theme-diag-option').forEach(function (option) {
						option.classList.toggle('selected', option.dataset.value === value);
					});
				};

				picker.addEventListener('click', function (ev) {
					ev.preventDefault();
					ev.stopPropagation();
					menu.hidden = !menu.hidden;
				});

				if (!document.__themeDiagOutside) {
					document.addEventListener('click', function (ev) {
						document.querySelectorAll('.theme-diag-menu').forEach(function (m) {
							if (!m.hidden && !m.parentElement.contains(ev.target))
								m.hidden = true;
						});
					});
					document.__themeDiagOutside = true;
				}

				run.type = 'button';
				run.className = 'cbi-button cbi-button-action theme-diag-run';
				run.textContent = base === 'traceroute' ? 'Traceroute' : 'Ping';
				run.style.setProperty('width', 'auto', 'important');
				run.style.setProperty('min-width', '90px', 'important');
				run.style.setProperty('flex', '0 0 auto', 'important');
				run.addEventListener('click', function () {
					setCommand(currentValue);
					dd.click();
				});

				dd.style.setProperty('display', 'none', 'important');
				dd.parentNode.insertBefore(wrap, dd);
				dd.parentNode.insertBefore(run, dd);
				dd.__themeDiagConverted = true;
			});

			td.querySelectorAll('.diag-action > .cbi-button').forEach(function (btn) {
				btn.style.setProperty('width', 'auto', 'important');
				btn.style.setProperty('min-width', '90px', 'important');
				btn.style.setProperty('flex', '0 0 auto', 'important');
			});
		});
	}

	function adaptFileBrowsers() {
		document.querySelectorAll('.cbi-filebrowser').forEach(function (browser) {
			/* Keep a single Cancel button.  The row-level Deselect button
			 * ("取消选择") is a different action and is redundant here. */
			browser.querySelectorAll('li > div:last-child > button').forEach(function (btn) {
				if (/^(取消|取消选择|Deselect)$/.test(String(btn.textContent || '').trim()) && btn.parentNode)
					btn.parentNode.removeChild(btn);
			});
		});
	}

	function adaptLegacyActions() {
		var actions = document.querySelector('#view .cbi-page-actions');

		if (!actions)
			return;

		var save = actions.querySelector('.cbi-button-save');
		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;

		if (document.body.classList.contains('node-system-crontab') && save) {
			var submit = zh ? '提交' : 'Submit';
			var textarea = document.querySelector('#view textarea');

			if (save.textContent !== submit)
				save.textContent = submit;

			if (textarea && textarea.__themeInitial === undefined)
				textarea.__themeInitial = textarea.value;

			if (!actions.querySelector('.cbi-button-reset')) {
				var reset = document.createElement('button');

				reset.type = 'button';
				reset.className = 'cbi-button cbi-button-reset';
				reset.textContent = zh ? '复位' : 'Reset';
				reset.addEventListener('click', function () {
					if (textarea && textarea.__themeInitial !== undefined)
						textarea.value = textarea.__themeInitial;
				});
				save.parentNode.insertBefore(reset, save.nextSibling);
			}
		}

		if (document.body.classList.contains('node-system-admin') && save &&
		    !actions.querySelector('.cbi-button-apply')) {
			var apply = save.cloneNode(true);

			apply.classList.remove('btn', 'cbi-button-save');
			apply.classList.add('cbi-button-apply', 'important');
			apply.textContent = zh ? '保存并应用' : 'Save & Apply';
			apply.addEventListener('click', function (ev) {
				ev.preventDefault();
				showLuaApply();
				save.click();
				window.setTimeout(function () {
					if (document.getElementById('theme-apply-fieldset'))
						finishLuaApply('配置已应用。');
				}, 900);
			});

			actions.insertBefore(apply, save);
		}
	}

	function showRawStatus(label, spinning, error) {
		var box = statusBox();

		if (!box)
			return;

		box.className = 'theme-apply-status show' + (spinning ? ' spinning' : '') + (error ? ' error' : ' success');

		if (spinning) {
			box.innerHTML = '<span class="theme-apply-spinner"></span><span></span>';
			box.lastElementChild.textContent = label;
		}
		else {
			var mark = document.createElement('span');

			mark.className = error ? 'theme-apply-error' : 'theme-apply-check';
			mark.textContent = error ? '!' : '✓';
			box.innerHTML = '';
			box.appendChild(mark);
			box.appendChild(document.createTextNode(' ' + label));
		}
	}

	function patchLegacyApply() {
		if (window.__themeLegacyApply)
			return true;

		if (typeof window.cbi_submit !== 'function')
			return false;

		var original = window.cbi_submit;

		window.cbi_submit = function (elem, name, value, action) {
			if (name !== 'cbi.apply')
				return original.apply(this, arguments);

			var form = elem.form || (elem.closest ? elem.closest('form') : null);
			var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;

			if (!form)
				return original.apply(this, arguments);

			/* cbi_submit normally appends the action field before posting. */
			var hidden = form.querySelector('input[type="hidden"][name="' + name + '"]');

			if (!hidden) {
				hidden = document.createElement('input');
				hidden.type = 'hidden';
				hidden.name = name;
				form.appendChild(hidden);
			}

			hidden.value = value || '1';

			showLuaApply();

			var body;

			try {
				body = new FormData(form);
			}
			catch (e) {
				body = null;
			}

			fetch(action || form.getAttribute('action') || location.href, {
				method: 'POST',
				body: body,
				credentials: 'same-origin'
			}).then(function (response) {
				if (!response.ok)
					throw new Error('HTTP ' + response.status);

				finishLuaApply(zh ? '配置已应用。' : 'Configuration changes applied.');
				window.setTimeout(function () {
					window.location.reload();
				}, 1500);
			}).catch(function () {
				failLuaApply(zh ? '应用失败，请重试' : 'Apply failed, please retry');
			});

			return false;
		};

		window.__themeLegacyApply = true;
		return true;
	}

	function adaptPager() {
		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;

		document.querySelectorAll('#view .pager, #maincontent .pager').forEach(function (pager) {
			var prev = pager.querySelector('.prev');
			var next = pager.querySelector('.next');

			if (prev) {
				prev.classList.remove('cbi-button-neutral');
				prev.classList.add('cbi-button', 'cbi-button-apply', 'important');
				if (prev.textContent !== (zh ? '前一页' : 'Previous'))
					prev.textContent = zh ? '前一页' : 'Previous';
			}

			if (next) {
				next.classList.remove('cbi-button-neutral');
				next.classList.add('cbi-button', 'cbi-button-apply', 'important');
				if (next.textContent !== (zh ? '后一页' : 'Next'))
					next.textContent = zh ? '后一页' : 'Next';
			}
		});
	}

	function maskToPrefix(mask) {
		var parts = String(mask || '').trim().split('.');

		if (parts.length !== 4)
			return 24;

		var bits = 0;

		for (var i = 0; i < 4; i++) {
			var n = parseInt(parts[i], 10);

			if (isNaN(n) || n < 0 || n > 255)
				return 24;

			bits += (n.toString(2).match(/1/g) || []).length;
		}

		return bits;
	}

	function prefixToMask(prefix) {
		var p = Math.max(0, Math.min(32, parseInt(prefix, 10) || 0));
		var n = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;

		return [
			(n >>> 24) & 255,
			(n >>> 16) & 255,
			(n >>> 8) & 255,
			n & 255
		].join('.');
	}

	function adaptRichSelects(root) {
		root = root || document;

		root.querySelectorAll('.cbi-dropdown').forEach(function (dd) {
			if (dd.__themeNativeSelect || dd.classList.contains('btn') ||
			    dd.closest('.cbi-page-actions') || !dd.closest('.cbi-value-field') ||
			    dd.hasAttribute('multiple') ||
			    dd.querySelector('input[type="text"]'))
				return;

			var ul = dd.querySelector('ul');
			var items = ul ? Array.prototype.slice.call(ul.children).filter(function (li) {
				return li.hasAttribute('data-value');
			}) : [];

			if (!items.length)
				return;

			var select = document.createElement('select');
			var selected = items.filter(function (li) {
				return li.hasAttribute('selected');
			})[0];

			select.className = 'cbi-input-select theme-native-select';
			select.id = (dd.id || 'theme-select') + '-native';

			items.forEach(function (li) {
				var option = document.createElement('option');
				var label = li.querySelector('.hide-open');
				var value = li.getAttribute('data-value');

				option.value = value;
				option.textContent = String(label ? label.textContent : li.textContent || '').trim();
				if (selected && li === selected)
					option.selected = true;
				select.appendChild(option);
			});

			if (!selected) {
				var empty = document.createElement('option');
				empty.value = '';
				empty.textContent = '--';
				select.insertBefore(empty, select.firstChild);
			}

			var field = dd.closest('.cbi-value');
			var title = field ? field.querySelector('.cbi-value-title') : null;

			if (title)
				title.htmlFor = select.id;

			dd.style.setProperty('display', 'none', 'important');
			dd.parentNode.insertBefore(select, dd.nextSibling);
			select.addEventListener('change', function () {
				var target = items.filter(function (li) {
					return li.getAttribute('data-value') === select.value;
				})[0];

				if (target) {
					/* ui.Dropdown only selects <li> elements while its
					 * internal list has the .dropdown class.  Open through
					 * the normal click handler, then click the option. */
					if (!dd.hasAttribute('open'))
						dd.click();

					target.click();

					if (dd.hasAttribute('open'))
						dd.removeAttribute('open');
				}
			});

			dd.__themeNativeSelect = true;
		});
	}

	function adaptNetworkGeneral(modal) {
		if (modal.__themeNetworkGeneral)
			return;

		var main = modal.querySelector('.cbi-map > .cbi-section');

		if (!main)
			return;

		var ipField = main.querySelector('[data-name="ipaddr"]');

		if (ipField && !ipField.__themeIpv4) {
			var dyn = ipField.querySelector('.cbi-dynlist');

			if (dyn) {
				var item = dyn.querySelector('.item');
				var hidden = item ? item.querySelector('input[type="hidden"]') : null;
				var current = hidden ? String(hidden.value || '') : '';
				var slash = current.lastIndexOf('/');
				var ip = slash >= 0 ? current.substring(0, slash) : current;
				var prefix = slash >= 0 ? current.substring(slash + 1) : '24';
				var fieldBox = ipField.querySelector('.cbi-value-field');
				var ipInput = document.createElement('input');
				var maskField = document.createElement('div');
				var maskTitle = document.createElement('label');
				var maskBox = document.createElement('div');
				var maskInput = document.createElement('input');

				var addItem = dyn.querySelector('.add-item');
				var extraCount = dyn.querySelectorAll('.item').length - 1;
				var addBtn = document.createElement('button');
				var ipRow = document.createElement('div');

				dyn.style.minHeight = '0';
				dyn.style.minWidth = '0';
				dyn.style.width = '100%';
				dyn.style.marginTop = extraCount > 0 ? '8px' : '0';
				if (item)
					item.style.display = 'none';
				if (addItem && extraCount < 1)
					addItem.style.display = 'none';

				ipInput.type = 'text';
				ipInput.className = 'cbi-input-text theme-ipv4-address';
				ipInput.value = ip;
				ipInput.placeholder = '例如：192.168.1.1';
				fieldBox.classList.add('theme-ipv4-field');

				maskField.className = 'cbi-value theme-ipv4-netmask';
				maskTitle.className = 'cbi-value-title';
				maskTitle.textContent = 'IPv4 子网掩码';
				maskBox.className = 'cbi-value-field';
				maskInput.type = 'text';
				maskInput.className = 'cbi-input-text';
				maskInput.value = prefixToMask(prefix);
				maskInput.placeholder = '255.255.255.0';
				addBtn.type = 'button';
				addBtn.className = 'btn cbi-button cbi-button-add theme-ipv4-add';
				addBtn.textContent = '+';
				addBtn.title = '添加 IPv4 地址';

				ipRow.className = 'theme-ipv4-input-row';
				ipRow.style.width = '100%';
				ipRow.style.maxWidth = '550px';
				ipInput.style.minWidth = '0';
				ipInput.style.width = '0';
				ipInput.style.flex = '1 1 auto';
				ipRow.appendChild(ipInput);
				ipRow.appendChild(addBtn);
				fieldBox.insertBefore(ipRow, dyn);
				fieldBox.appendChild(dyn);
				maskBox.appendChild(maskInput);
				maskField.appendChild(maskTitle);
				maskField.appendChild(maskBox);
				ipField.parentNode.insertBefore(maskField, ipField.nextSibling);

				addBtn.addEventListener('click', function () {
					dyn.style.minHeight = '';
					dyn.style.marginTop = '8px';
					if (addItem)
						addItem.style.display = '';
					var input = addItem ? addItem.querySelector('input') : null;

					if (input) {
						input.focus();
						input.scrollIntoView({ block: 'nearest' });
					}
				});

				var syncIpv4 = function () {
					var target = dyn.querySelector('.item input[type="hidden"]');

					if (!target) {
						item = document.createElement('div');
						item.className = 'item';
						target = document.createElement('input');
						target.type = 'hidden';
						item.appendChild(target);
						dyn.insertBefore(item, dyn.firstChild);
					}

					target.value = String(ipInput.value || '').trim() + '/' +
						maskToPrefix(maskInput.value);
				};

				ipInput.addEventListener('input', syncIpv4);
				maskInput.addEventListener('input', syncIpv4);

				var syncMaskVisibility = function () {
					maskField.style.display = ipField.getBoundingClientRect().height > 0 ? '' : 'none';
				};

				var proto = main.querySelector('[data-name="proto"] select');
				if (proto) {
					proto.addEventListener('change', function () {
						window.setTimeout(syncMaskVisibility, 80);
					});
				}

				syncMaskVisibility();
				ipField.__themeIpv4 = true;
			}
		}

		var dns = main.querySelector('[data-name="dns"]');

		if (dns && !dns.__themeDnsMoved) {
			var general = main.querySelector('.cbi-section-node-tabbed > div[data-tab="general"]') ||
			              main.querySelector('div[data-tab="general"]') ||
			              main.querySelector('#container\\.network\\.lan\\.general');
			var broadcast = main.querySelector('[data-name="broadcast"]');

			if (general) {
				if (broadcast && broadcast.parentNode === general)
					general.insertBefore(dns, broadcast.nextSibling);
				else
					general.appendChild(dns);

				dns.style.display = '';
				var dnsAdd = dns.querySelector('.add-item input');

				if (dnsAdd && !dnsAdd.placeholder)
					dnsAdd.placeholder = '添加 DNS 服务器…';

				dns.__themeDnsMoved = true;
			}
		}

		var generalPane = main.querySelector('.cbi-section-node-tabbed > div[data-tab="general"]') ||
		                  main.querySelector('div[data-tab="general"]');
		var autoField = main.querySelector('[data-name="auto"]');
		var ip6prefix = main.querySelector('[data-name="ip6prefix"]');

		if (generalPane && autoField && ip6prefix &&
		    autoField.parentNode === generalPane && ip6prefix.parentNode === generalPane)
			generalPane.insertBefore(autoField, ip6prefix.nextSibling);

		/* Keep the Lua labels for the shared fields. */
		[
			['proto', '传输协议'],
			['auto', '开机自动运行'],
			['broadcast', 'IPv4 广播']
		].forEach(function (pair) {
			var field = main.querySelector('[data-name="' + pair[0] + '"]');
			var title = field ? field.querySelector('.cbi-value-title') : null;

			if (title)
				title.textContent = pair[1];
		});

		modal.__themeNetworkGeneral = true;
	}

	function saveModalMaps(modal, applyChanges) {
		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;
		var maps = Array.prototype.slice.call(modal.querySelectorAll('.cbi-map'));
		var tasks = [];

		showLuaApply();

		maps.forEach(function (map) {
			var instance = window.L && L.dom && L.dom.findClassInstance
				? L.dom.findClassInstance(map) : null;

			if (instance && typeof instance.save === 'function')
				tasks.push(Promise.resolve(instance.save()));
		});

		return Promise.all(tasks).then(function () {
			if (applyChanges && window.L && L.ui && L.ui.changes &&
			    typeof L.ui.changes.apply === 'function')
				return L.ui.changes.apply(false);
		}).then(function () {
			if (document.getElementById('theme-apply-fieldset'))
				finishLuaApply(applyChanges ? '配置已应用。' : '配置已保存。');
		}).catch(function (err) {
			failLuaApply((zh ? '保存失败：' : 'Save failed: ') +
				(err && err.message ? err.message : err));
		});
	}

	function makeNetworkInline(modal) {
		if (modal.__themeInline)
			return;

		/* Do not move the modal DOM: LuCI keeps the form.Map class
		 * instance on the modal subtree.  Moving it breaks save/apply
		 * silently while the button still spins.  Present the intact
		 * modal as a full-page editor instead. */
		var close = Array.prototype.slice.call(modal.querySelectorAll('.button-row button')).filter(function (btn) {
			return /^(关闭|Close)$/.test(String(btn.textContent || '').trim());
		})[0];
		var coreSave = Array.prototype.slice.call(modal.querySelectorAll('.button-row button')).filter(function (btn) {
			return /^(保存|Save)$/.test(String(btn.textContent || '').trim());
		})[0];

		if (coreSave && !coreSave.__themeSaveBound) {
			coreSave.addEventListener('click', function (ev) {
				ev.preventDefault();
				ev.stopImmediatePropagation();
				saveModalMaps(modal, true);
			}, true);
			coreSave.__themeSaveBound = true;
		}

		['保存并应用', 'Save & Apply', '复位', 'Reset'].forEach(function (label) {
			var matches = Array.prototype.slice.call(modal.querySelectorAll('.button-row button')).filter(function (btn) {
				return String(btn.textContent || '').trim() === label;
			});

			matches.slice(1).forEach(function (btn) {
				if (btn.parentNode)
					btn.parentNode.removeChild(btn);
			});
		});

		if (close)
			close.addEventListener('click', function () {
				window.location.href = '/cgi-bin/luci/admin/network/network';
			});

		document.body.classList.add('theme-network-page');
		modal.__themeInline = true;
		var overlay = document.getElementById('modal_overlay');

		if (overlay)
			overlay.scrollTop = 0;
	}

	function adaptNetworkModal() {
		if (!document.body.classList.contains('node-network-network'))
			return;

		var modal = document.querySelector('#modal_overlay .modal');

		if (!modal)
			return;

		adaptNetworkGeneral(modal);

		if (modal.__themeNetworkActions)
			return;

		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;
		var title = modal.querySelector('h4');
		var buttons = Array.prototype.slice.call(modal.querySelectorAll('button'));

		if (title && !modal.querySelector('.theme-network-title')) {
			var h2 = document.createElement('h2');

			h2.className = 'theme-network-title';
			h2.textContent = String(title.textContent || '').replace('»', '-').replace(/\blan\b/i, 'LAN');
			title.parentNode.replaceChild(h2, title);

			var descr = document.createElement('div');

			descr.className = 'cbi-map-descr';
			descr.textContent = zh ? '在此页面，您可以配置网络接口。' : 'Configure the network interface on this page.';
			h2.parentNode.insertBefore(descr, h2.nextSibling);
		}

		var save = buttons.filter(function (btn) {
			return /^(保存|Save)$/.test(String(btn.textContent || '').trim());
		})[0];

		if (!save)
			return;

		/* The Lua editor has a separate DHCP server section below the
		 * interface section, not another tab inside the interface card. */
		var dhcp = modal.querySelector('#container\\.network\\.lan\\.dhcp') ||
		           modal.querySelector('div[data-tab="dhcp"]');

		if (dhcp && !modal.querySelector('.theme-network-dhcp')) {
			var section = document.createElement('div');
			var heading = document.createElement('h3');

			section.className = 'cbi-section theme-network-dhcp';
			heading.textContent = zh ? 'DHCP 服务器' : 'DHCP Server';
			dhcp.removeAttribute('data-tab-title');
			dhcp.setAttribute('data-tab-active', 'true');
			dhcp.style.setProperty('display', 'block', 'important');
			dhcp.style.setProperty('height', 'auto', 'important');
			dhcp.style.setProperty('opacity', '1', 'important');
			dhcp.style.setProperty('overflow', 'visible', 'important');
			dhcp.classList.add('theme-network-dhcp-pane');
			section.appendChild(heading);
			section.appendChild(dhcp);

			var mainSection = modal.querySelector('.cbi-map > .cbi-section');

			if (mainSection && mainSection.parentNode)
				mainSection.parentNode.insertBefore(section, mainSection.nextSibling);
			else {
				var map = modal.querySelector('.cbi-map');
				if (map)
					map.appendChild(section);
			}

			var mainMenu = modal.querySelector('.cbi-map > .cbi-section > .cbi-tabmenu');
			var dhcpTab = mainMenu ? mainMenu.querySelector(':scope > li[data-tab="dhcp"]') : null;

			if (dhcpTab)
				dhcpTab.parentNode.removeChild(dhcpTab);

			var ignore = null;

			dhcp.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
				var label = cb.closest('.cbi-value');
				var title = label ? label.querySelector('.cbi-value-title') : null;

				if (title && String(title.textContent || '').trim() === '忽略此接口')
					ignore = cb;
			});

			if (ignore && !dhcp.__themeIgnoreBound) {
				var ignoreField = ignore.closest('.cbi-value');

				if (ignoreField)
					ignoreField.classList.add('theme-dhcp-ignore');

				var syncIgnore = function () {
					section.classList.toggle('theme-dhcp-ignored', !!ignore.checked);
				};

				ignore.addEventListener('click', syncIgnore);
				ignore.addEventListener('change', syncIgnore);
				syncIgnore();
				dhcp.__themeIgnoreBound = true;
			}
		}

		/* Lua groups the DHCP options as Basic / Advanced / IPv6.  The
		 * 25.12 form puts start/limit in the IPv4 tab and dynamic options
		 * in the basic tab; move them without dropping any new fields. */
		var dhcpBasic = modal.querySelector('#container\\.dhcp\\.lan\\.general');
		var dhcpAdvanced = modal.querySelector('#container\\.dhcp\\.lan\\.ipv4');

		if (dhcpBasic && dhcpAdvanced && !dhcpBasic.__themeLuaLayout) {
			var byId = function (id) { return document.getElementById('cbi-dhcp-lan-' + id); };
			var startField = byId('start');
			var limitField = byId('limit');
			var leaseField = byId('leasetime');
			var dynamicField = byId('dynamicdhcp');
			var forceField = byId('force');
			var optionField = byId('dhcp_option');
			var forceOptionField = byId('dhcp_option_force');
			var netmaskField = byId('netmask');
			var serviceField = byId('dhcpv4');

			[startField, limitField, leaseField].forEach(function (field) {
				if (field)
					dhcpBasic.appendChild(field);
			});

			[serviceField, dynamicField, forceField, netmaskField, optionField, forceOptionField].forEach(function (field) {
				if (field)
					dhcpAdvanced.appendChild(field);
			});

			[
				[startField, '启动'],
				[limitField, '客户数'],
				[leaseField, '租期']
			].forEach(function (pair) {
				var title = pair[0] ? pair[0].querySelector('.cbi-value-title') : null;

				if (title)
					title.textContent = pair[1];
			});

			var basicTab = modal.querySelector('.theme-network-dhcp .cbi-tabmenu li[data-tab="general"] a');
			var advancedTab = modal.querySelector('.theme-network-dhcp .cbi-tabmenu li[data-tab="ipv4"] a');

			if (basicTab)
				basicTab.textContent = '基本设置';
			if (advancedTab)
				advancedTab.textContent = '高级设置';

			dhcpBasic.__themeLuaLayout = true;
		}

		var buttonRow = modal.querySelector('.button-row');
		var generalSection = modal.querySelector('.cbi-map > .cbi-section');

		/* Lua has one IPv6 tab; 25.12 split it into IPv6, DHCPv6 and
		 * IPv6-RA tabs.  Merge them while keeping every new field. */
		var ipv6Pane = modal.querySelector('#container\\.dhcp\\.lan\\.ipv6');
		var dhcpMenu = modal.querySelector('.theme-network-dhcp .cbi-tabmenu');

		if (ipv6Pane && dhcpMenu && !ipv6Pane.__themeMergedIpv6) {
			['dhcpv6', 'ipv6-ra'].forEach(function (tab) {
				var pane = modal.querySelector('#container\\.dhcp\\.lan\\.' + tab);

				if (pane) {
					Array.prototype.slice.call(pane.querySelectorAll('.cbi-value')).forEach(function (field) {
						ipv6Pane.appendChild(field);
					});
					if (pane.parentNode)
						pane.parentNode.removeChild(pane);
				}

				var item = dhcpMenu.querySelector(':scope > li[data-tab="' + tab + '"]');
				if (item && item.parentNode)
					item.parentNode.removeChild(item);
			});
			ipv6Pane.__themeMergedIpv6 = true;
		}

		if (generalSection && !generalSection.querySelector('.theme-network-general')) {
			var generalTitle = document.createElement('h3');

			generalTitle.className = 'theme-network-general';
			generalTitle.textContent = zh ? '一般配置' : 'General Configuration';

			var generalMenu = generalSection.querySelector('.cbi-tabmenu');

			if (generalMenu)
				generalSection.insertBefore(generalTitle, generalMenu);
			else
				generalSection.insertBefore(generalTitle, generalSection.firstChild);
		}

		if (buttonRow && !buttonRow.querySelector('.theme-return-overview')) {
			var back = document.createElement('button');

			back.type = 'button';
			back.className = 'btn cbi-button cbi-button-link theme-return-overview';
			back.textContent = zh ? '返回至概况' : 'Back to overview';
			back.addEventListener('click', function () {
				window.location.href = '/cgi-bin/luci/admin/network/network';
			});
			buttonRow.insertBefore(back, buttonRow.firstChild);
		}

		var apply = save.cloneNode(true);

		apply.classList.remove('btn', 'cbi-button-positive');
		apply.classList.add('cbi-button-apply', 'important');
		apply.textContent = zh ? '保存并应用' : 'Save & Apply';
		apply.addEventListener('click', function (ev) {
			ev.preventDefault();
			saveModalMaps(modal, true);
		});

		var reset = document.createElement('button');

		reset.type = 'button';
		reset.className = 'btn cbi-button cbi-button-reset';
		reset.textContent = zh ? '复位' : 'Reset';
		reset.addEventListener('click', function () {
			window.location.reload();
		});

		save.parentNode.insertBefore(apply, save);
		save.parentNode.insertBefore(reset, save.nextSibling);
		modal.__themeNetworkActions = true;
		makeNetworkInline(modal);
	}

	function adaptModalActions() {
		var modal = document.querySelector('#modal_overlay .modal');

		if (!modal || modal.__themeModalActions || modal.querySelector('.theme-return-overview'))
			return;

		var buttons = Array.prototype.slice.call(modal.querySelectorAll('button'));
		var save = buttons.filter(function (btn) {
			return /^(保存|Save)$/.test(String(btn.textContent || '').trim());
		})[0];

		if (!save)
			return;

		var zh = String(document.documentElement.lang || '').indexOf('zh') === 0;

		var apply = save.cloneNode(true);

		apply.classList.remove('btn', 'cbi-button-positive');
		apply.classList.add('cbi-button-apply', 'important');
		apply.textContent = zh ? '保存并应用' : 'Save & Apply';
		apply.addEventListener('click', function (ev) {
			ev.preventDefault();
			saveModalMaps(modal, true);
		});

		var reset = document.createElement('button');

		reset.type = 'button';
		reset.className = 'btn cbi-button cbi-button-reset';
		reset.textContent = zh ? '复位' : 'Reset';
		reset.addEventListener('click', function () {
			window.location.reload();
		});

		save.parentNode.insertBefore(apply, save);
		save.parentNode.insertBefore(reset, save.nextSibling);
		modal.__themeModalActions = true;
	}

	function normalizeLegacyApplyButtons() {
		document.querySelectorAll('input.cbi-button-apply').forEach(function (input) {
			if (input.__themeApplyButton)
				return;

			if (!/保存|Save/i.test(input.value || ''))
				return;

			var btn = makeApplyButton();

			btn.disabled = !!input.disabled;
			input.parentNode.insertBefore(btn, input.nextSibling);
			input.style.setProperty('display', 'none', 'important');
			btn.addEventListener('click', function () {
				input.click();
			});
			input.__themeApplyButton = true;
		});
	}

	function normalizeButtons() {
		document.querySelectorAll('.btn[class*="cbi-button-"]:not(.cbi-button)').forEach(function (btn) {
			if (btn.classList.contains('theme-remove-link'))
				return;

			btn.classList.add('cbi-button');
		});
	}

	/*
	 * Generic adapters apply to every LuCI page (including newly installed
	 * menu entries).  Page-specific adapters only handle semantic structures
	 * that cannot be inferred from the generic control classes.
	 */
	function adaptGenericPage() {
		adaptRichSelects(document);
		adaptDynlists();
		adaptFileUploads();
		adaptFileBrowsers();
		adaptPager();
		adaptModalActions();
		normalizeLegacyApplyButtons();
		normalizeButtons();
	}

	function adaptSpecialPage() {
		adaptProcesses();
		adaptStartup();
		adaptPackages();
		adaptLegacyActions();
		adaptNetworkModal();
		adaptDiagnostics();
		adaptCrontabHelp();
	}

	function adaptPage() {
		adaptGenericPage();
		adaptSpecialPage();
	}

	/*
	 * ThemeAdaptive is the public adapter registry.  New pages are adapted
	 * automatically because every adapter is selector/feature based and the
	 * registry is re-run after DOM changes.  A failing adapter is isolated so
	 * it cannot stop the other modules.
	 */
	var ThemeAdaptive = window.ThemeAdaptive = (function () {
		var adapters = [];

		function register(name, fn, options) {
			adapters.push({
				name: name,
				fn: fn,
				priority: options && options.priority || 0
			});
			adapters.sort(function (a, b) { return a.priority - b.priority; });
			return ThemeAdaptive;
		}

		function run() {
			adapters.forEach(function (adapter) {
				try {
					adapter.fn();
				}
				catch (e) {
					if (window.console && console.warn)
						console.warn('[theme] adapter failed:', adapter.name, e);
				}
			});
		}

		return {
			version: '2.0',
			register: register,
			run: run,
			list: function () { return adapters.map(function (a) { return a.name; }); }
		};
	})();

	ThemeAdaptive
		.register('apply-modal-suppress', suppressApplyModal, { priority: 9 })
		.register('apply-status', patchStatus, { priority: 10 })
		.register('apply-modal', patchShowModal, { priority: 11 })
		.register('legacy-apply', patchLegacyApply, { priority: 12 })
		.register('page-actions', patchActions, { priority: 20 })
		.register('generic-controls', adaptGenericPage, { priority: 30 })
		.register('special-pages', adaptSpecialPage, { priority: 40 });

	function patchAll() {
		ThemeAdaptive.run();
	}

	/*
	 * LuCI 25.12 opens the software page on the "available" tab.  On images
	 * without configured repositories that tab is empty while the Lua theme
	 * opened the installed package list.  Keep the Lua behaviour.
	 */
	function fixPackageTab() {
		if (!document.body.classList.contains('node-system-package-manager'))
			return;

		var menu = document.querySelector('#view .cbi-tabmenu.mode');

		if (!menu)
			return;

		if (!menu.__themeTabListener) {
			menu.addEventListener('click', function () {
				menu.__themeUserTab = true;
			}, true);

			menu.__themeTabListener = true;
		}

		if (menu.__themeAutoDone || menu.__themeUserTab)
			return;

		var installed = menu.querySelector('li[data-mode="installed"]');

		if (installed && !installed.classList.contains('cbi-tab')) {
			var link = installed.querySelector('a');

			if (link)
				link.click();
		}

		menu.__themeAutoDone = true;
	}

	var adaptiveScheduled = false;

	function scheduleAdaptive() {
		if (adaptiveScheduled)
			return;

		adaptiveScheduled = true;

		var run = function () {
			adaptiveScheduled = false;
			ThemeAdaptive.run();
		};

		if (window.requestAnimationFrame)
			window.requestAnimationFrame(run);
		else
			window.setTimeout(run, 16);
	}

	document.addEventListener('luci-loaded', patchAll);
	document.addEventListener('DOMContentLoaded', patchAll);
	window.addEventListener('hashchange', scheduleAdaptive);
	window.addEventListener('popstate', scheduleAdaptive);

	document.addEventListener('uci-applied', function () {
		finishLuaApply('配置已应用。');
		window.setTimeout(function () {
			window.location.reload();
		}, 1500);
	});

	if (document.readyState !== 'loading')
		patchAll();

	if (window.MutationObserver) {
		new MutationObserver(scheduleAdaptive)
			.observe(document.documentElement, {
				childList: true,
				subtree: true
			});
	}

	window.setTimeout(patchAll, 300);
	window.setTimeout(patchAll, 1200);

	var statusTries = 0;
	var statusTimer = window.setInterval(function () {
		suppressApplyModal();
		patchStatus();
		patchShowModal();

		if (++statusTries > 240)
			window.clearInterval(statusTimer);
	}, 250);

	var legacyTries = 0;
	var legacyTimer = window.setInterval(function () {
		if (patchLegacyApply() || ++legacyTries > 20)
			window.clearInterval(legacyTimer);
	}, 250);

	var pkgTries = 0;
	var pkgTimer = window.setInterval(function () {
		fixPackageTab();
		ThemeAdaptive.run();

		if (++pkgTries > 8)
			window.clearInterval(pkgTimer);
	}, 500);
})();
