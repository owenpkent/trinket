import './shell/styles.css';
import { startApp } from './shell/app';
// Side-effect import: every built-in toy registers itself here.
import './toys';

const root = document.getElementById('app');
if (!root) throw new Error('Trinket: #app is missing from index.html.');

startApp(root);
