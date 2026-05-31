import { mergeConfig } from 'vitest/config';
import base from './index.js';

export default mergeConfig(base, { test: { environment: 'jsdom' } });
