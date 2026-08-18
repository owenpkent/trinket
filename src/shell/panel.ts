import type { Control, ParamStore, ParamValue } from '@sdk';

/**
 * Renders the control panel for a toy from its declared controls.
 *
 * This is the payoff of the declarative control schema: a contributor writes a
 * `controls` array and gets a working, styled, two-way-bound panel without
 * writing any DOM. Widgets are pointer-first, with generous hit targets.
 */
export function createPanel(params: ParamStore, accent: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.setProperty('--accent', accent);

  if (params.controls.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-empty';
    empty.textContent = 'This toy has no settings. Just play with it.';
    panel.appendChild(empty);
    return panel;
  }

  // Each entry knows how to push a store value back into its widget, so
  // params.set() from inside a toy keeps the UI honest.
  const sync = new Map<string, (value: ParamValue) => void>();

  for (const control of params.controls) {
    panel.appendChild(buildRow(control, params, sync));
  }

  const unsubscribe = params.subscribe((id, value) => sync.get(id)?.(value));
  // The panel is discarded wholesale on toy switch; drop the subscription with it.
  new MutationObserver((_records, observer) => {
    if (!panel.isConnected) {
      unsubscribe();
      observer.disconnect();
    }
  }).observe(document.body, { childList: true, subtree: true });

  return panel;
}

function buildRow(
  control: Control,
  params: ParamStore,
  sync: Map<string, (value: ParamValue) => void>,
): HTMLElement {
  const row = document.createElement('div');
  row.className = `panel-row panel-row-${control.type}`;
  if (control.help) row.title = control.help;

  if (control.type === 'action') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-action';
    button.textContent = control.label;
    button.addEventListener('click', () => params.trigger(control.id));
    row.appendChild(button);
    return row;
  }

  const label = document.createElement('label');
  label.className = 'panel-label';
  label.textContent = control.label;
  const inputId = `ctl-${control.id}`;
  label.htmlFor = inputId;
  row.appendChild(label);

  switch (control.type) {
    case 'range': {
      const readout = document.createElement('span');
      readout.className = 'panel-readout';
      row.appendChild(readout);

      const input = document.createElement('input');
      input.type = 'range';
      input.id = inputId;
      input.className = 'panel-range';
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step ?? (control.max - control.min) / 100);
      input.value = String(control.default);

      const show = (value: number): void => {
        // Match the readout precision to the step so 0.30000000000000004 never shows.
        const step = Number(input.step);
        const decimals = step >= 1 ? 0 : Math.min(3, String(step).split('.')[1]?.length ?? 2);
        readout.textContent = `${value.toFixed(decimals)}${control.unit ?? ''}`;
      };

      input.addEventListener('input', () => {
        const value = Number(input.value);
        params.set(control.id, value);
        show(value);
      });
      sync.set(control.id, (value) => {
        input.value = String(value);
        show(Number(value));
      });
      show(control.default);
      row.appendChild(input);
      break;
    }

    case 'toggle': {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = inputId;
      input.className = 'panel-toggle-input';
      input.checked = control.default;
      const track = document.createElement('label');
      track.className = 'panel-toggle';
      track.htmlFor = inputId;
      input.addEventListener('change', () => params.set(control.id, input.checked));
      sync.set(control.id, (value) => {
        input.checked = Boolean(value);
      });
      row.appendChild(input);
      row.appendChild(track);
      break;
    }

    case 'select': {
      const select = document.createElement('select');
      select.id = inputId;
      select.className = 'panel-select';
      for (const option of control.options) {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        select.appendChild(element);
      }
      select.value = control.default;
      select.addEventListener('change', () => params.set(control.id, select.value));
      sync.set(control.id, (value) => {
        select.value = String(value);
      });
      row.appendChild(select);
      break;
    }

    case 'color': {
      const input = document.createElement('input');
      input.type = 'color';
      input.id = inputId;
      input.className = 'panel-color';
      input.value = control.default;
      input.addEventListener('input', () => params.set(control.id, input.value));
      sync.set(control.id, (value) => {
        input.value = String(value);
      });
      row.appendChild(input);
      break;
    }
  }

  return row;
}
