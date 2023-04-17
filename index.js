import { App } from './app.js';
import { devicesRouter } from './devices.js';

const app = new App();

devicesRouter(app);

app.listen(3000);
