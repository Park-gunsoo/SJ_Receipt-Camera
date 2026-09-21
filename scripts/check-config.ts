import "dotenv/config";
import { configuration } from "../src/lib/config";
const result = configuration();
console.log(result.ready ? "All configuration keys are present. This does not verify external services." : `Missing configuration: ${result.missing.join(", ")}`);
process.exitCode = result.ready ? 0 : 1;
