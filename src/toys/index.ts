import { registerToy } from '@sdk';

import fallingSand from './falling-sand';
import ferrofluid from './ferrofluid';
import lavaLamp from './lava-lamp';
import ripplePool from './ripple-pool';

/**
 * The shelf, in display order.
 *
 * Adding a toy is two lines: import it, then list it here. See
 * docs/TOY_API.md for what a toy module has to export.
 */
for (const toy of [lavaLamp, fallingSand, ripplePool, ferrofluid]) {
  registerToy(toy);
}
