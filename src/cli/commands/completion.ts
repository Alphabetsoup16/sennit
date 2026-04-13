import type { Command } from "commander";

const TOP_LEVEL = [
  "serve",
  "plan",
  "doctor",
  "config",
  "setup",
  "onboard",
  "version",
  "help",
  "completion",
  "call",
];

const CONFIG_SUB = ["path", "validate", "print", "schema"];

function bashScript(): string {
  return `#!/usr/bin/env bash
# Sennit shell completion (bash). Source: eval "$(sennit completion bash)"
_sennit() {
  local cur=\${COMP_WORDS[COMP_CWORD]}
  local prev=\${COMP_WORDS[COMP_CWORD-1]}
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${TOP_LEVEL.join(" ")}" -- "$cur") )
    return
  fi
  local root=\${COMP_WORDS[1]}
  if [[ "$root" == "config" && \${COMP_CWORD} -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "${CONFIG_SUB.join(" ")}" -- "$cur") )
    return
  fi
  if [[ "$root" == "doctor" && "$prev" == "doctor" && \${COMP_CWORD} -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "inspect" -- "$cur") )
    return
  fi
}
complete -F _sennit sennit
`;
}

function zshScript(): string {
  return `#compdef sennit
# Sennit shell completion (zsh). Example: source <(sennit completion zsh)
if (( CURRENT == 2 )); then
  compadd ${TOP_LEVEL.join(" ")}
elif [[ $words[2] == config ]] && (( CURRENT == 3 )); then
  compadd ${CONFIG_SUB.join(" ")}
elif [[ $words[2] == doctor ]] && (( CURRENT == 3 )); then
  compadd inspect
fi
`;
}

function fishScript(): string {
  return `# Sennit completion (fish)
complete -c sennit -f -n '__fish_use_subcommand' -a 'serve plan doctor config setup onboard version help completion call'
complete -c sennit -f -n '__fish_seen_subcommand_from config' -a 'path validate print schema'
complete -c sennit -f -n '__fish_seen_subcommand_from doctor' -a inspect
`;
}

export function registerCompletion(program: Command): void {
  program
    .command("completion")
    .description("Print a shell completion script for bash, zsh, or fish")
    .argument("<shell>", "bash | zsh | fish")
    .action((shell: string) => {
      const s = shell.toLowerCase().trim();
      if (s === "bash") {
        process.stdout.write(bashScript());
        return;
      }
      if (s === "zsh") {
        process.stdout.write(zshScript());
        return;
      }
      if (s === "fish") {
        process.stdout.write(fishScript());
        return;
      }
      process.stderr.write(`Unknown shell ${JSON.stringify(shell)}. Use bash, zsh, or fish.\n`);
      process.exitCode = 1;
    });
}
