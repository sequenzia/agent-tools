#!/usr/bin/env node

import { Command } from "commander";
import { killCommand } from "./commands/kill.js";
import { listCommand } from "./commands/list.js";
import { logsCommand } from "./commands/logs.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";

const program = new Command();

program
  .name("agt")
  .description("CLI tool for managing agent-tools apps")
  .version("0.1.0");

program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(logsCommand);
program.addCommand(killCommand);
program.addCommand(listCommand);

program.parse();
