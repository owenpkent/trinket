import { allToys, getToy, type ToyDefinition } from '@sdk';
import { isAlwaysOnTop, isDesktop, toggleAlwaysOnTop } from './desktop';
import { mountToy, type ToyHost } from './host';
import { createPanel } from './panel';

/**
 * The shell: a shelf of toys, and a stage that runs one at a time.
 *
 * Routing is the URL hash, so #/lava-lamp deep links straight into a toy and
 * the desktop build restores the last toy on launch for free.
 */
export function startApp(root: HTMLElement): void {
  root.innerHTML = '';
  root.className = 'app';

  const stage = document.createElement('main');
  stage.className = 'stage';
  root.appendChild(stage);

  let host: ToyHost | null = null;
  let panelOpen = true;

  const teardown = (): void => {
    host?.dispose();
    host = null;
    stage.innerHTML = '';
    stage.className = 'stage';
    stage.style.removeProperty('--accent');
  };

  const showShelf = (): void => {
    teardown();
    document.title = 'Trinket';
    stage.classList.add('stage-shelf');
    stage.appendChild(renderShelf());
  };

  const showToy = (definition: ToyDefinition): void => {
    teardown();
    document.title = `${definition.name} | Trinket`;
    stage.classList.add('stage-toy');
    stage.style.setProperty('--accent', definition.accent);

    const surface = document.createElement('div');
    surface.className = 'toy-surface';
    stage.appendChild(surface);

    try {
      host = mountToy(surface, definition);
    } catch (error) {
      stage.appendChild(renderFailure(definition, error));
      return;
    }

    stage.appendChild(renderToyChrome(definition, host, () => panelOpen, setPanelOpen));
    applyPanelState();
  };

  const setPanelOpen = (open: boolean): void => {
    panelOpen = open;
    applyPanelState();
  };

  const applyPanelState = (): void => {
    stage.classList.toggle('panel-open', panelOpen);
  };

  const route = (): void => {
    const id = window.location.hash.replace(/^#\/?/, '').trim();
    if (!id) {
      showShelf();
      return;
    }
    const definition = getToy(id);
    if (!definition) {
      // An unknown id is almost always a stale link; fall back rather than error.
      window.location.hash = '';
      showShelf();
      return;
    }
    showToy(definition);
  };

  window.addEventListener('hashchange', route);
  route();
}

function renderShelf(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'shelf';

  const header = document.createElement('header');
  header.className = 'shelf-header';
  header.innerHTML = `
    <h1 class="shelf-title">Trinket</h1>
    <p class="shelf-tagline">A shelf of things to fiddle with. Pick one up.</p>
  `;
  wrap.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'shelf-grid';
  for (const toy of allToys()) {
    grid.appendChild(renderCard(toy));
  }
  wrap.appendChild(grid);

  const footer = document.createElement('footer');
  footer.className = 'shelf-footer';
  footer.innerHTML = `
    <span>Every toy here is one file and a control list.</span>
    <a href="https://github.com/owenpkent/trinket#adding-a-toy" target="_blank" rel="noreferrer">
      Add your own
    </a>
  `;
  wrap.appendChild(footer);

  return wrap;
}

function renderCard(toy: ToyDefinition): HTMLElement {
  const card = document.createElement('a');
  card.className = 'card';
  card.href = `#/${toy.id}`;
  card.style.setProperty('--accent', toy.accent);

  const name = document.createElement('h2');
  name.className = 'card-name';
  name.textContent = toy.name;

  const blurb = document.createElement('p');
  blurb.className = 'card-blurb';
  blurb.textContent = toy.blurb;

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.textContent = toy.author;

  const glow = document.createElement('div');
  glow.className = 'card-glow';
  glow.setAttribute('aria-hidden', 'true');

  card.append(glow, name, blurb, meta);
  return card;
}

function renderToyChrome(
  definition: ToyDefinition,
  host: ToyHost,
  isPanelOpen: () => boolean,
  setPanelOpen: (open: boolean) => void,
): HTMLElement {
  const chrome = document.createElement('div');
  chrome.className = 'chrome';

  const bar = document.createElement('div');
  bar.className = 'chrome-bar';

  const back = document.createElement('a');
  back.className = 'chrome-button chrome-back';
  back.href = '#/';
  back.textContent = 'Shelf';
  back.title = 'Back to the shelf';

  const title = document.createElement('span');
  title.className = 'chrome-title';
  title.textContent = definition.name;

  const spacer = document.createElement('span');
  spacer.className = 'chrome-spacer';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'chrome-button';
  reset.textContent = 'Reset';
  reset.title = 'Restore defaults and start over';
  reset.addEventListener('click', () => host.reset());

  bar.append(back, title, spacer);

  // Only the desktop build can pin itself above other windows.
  if (isDesktop()) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'chrome-button';
    pin.textContent = 'Pin';
    pin.title = 'Keep this window above everything else';
    pin.classList.toggle('is-active', isAlwaysOnTop());
    pin.addEventListener('click', () => {
      void toggleAlwaysOnTop().then((pinned) => pin.classList.toggle('is-active', pinned));
    });
    bar.appendChild(pin);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'chrome-button chrome-toggle';
  toggle.title = 'Show or hide the controls';
  const paintToggle = (): void => {
    toggle.textContent = isPanelOpen() ? 'Hide controls' : 'Controls';
    toggle.classList.toggle('is-active', isPanelOpen());
  };
  toggle.addEventListener('click', () => {
    setPanelOpen(!isPanelOpen());
    paintToggle();
  });
  paintToggle();

  bar.append(reset, toggle);
  chrome.appendChild(bar);

  const panel = createPanel(host.params, definition.accent);
  const panelHeader = document.createElement('div');
  panelHeader.className = 'panel-header';
  panelHeader.textContent = definition.blurb;
  panel.prepend(panelHeader);
  chrome.appendChild(panel);

  return chrome;
}

function renderFailure(definition: ToyDefinition, error: unknown): HTMLElement {
  const box = document.createElement('div');
  box.className = 'failure';
  const message = error instanceof Error ? error.message : String(error);
  const heading = document.createElement('h2');
  heading.textContent = `${definition.name} could not start`;
  const detail = document.createElement('pre');
  detail.textContent = message;
  const back = document.createElement('a');
  back.className = 'chrome-button';
  back.href = '#/';
  back.textContent = 'Back to the shelf';
  box.append(heading, detail, back);
  return box;
}
