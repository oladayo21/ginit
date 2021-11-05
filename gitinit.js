import { Octokit } from '@octokit/rest';
import execa from 'execa';
import chalk from 'chalk';
import Listr from 'listr';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';

const PAT_FILEPATH = join(homedir(), '.config', 'gitinit', 'pat');
const ROOT_DIR = process.cwd();

function getAccessToken() {
  //TODO: Allow user pass in the file path to PAT later or give the PAT themselves

  if (!existsSync(PAT_FILEPATH)) {
    throw new Error('No github personal access token file detected');
  }
  const accessToken = readFileSync(PAT_FILEPATH, { encoding: 'utf-8' });
  if (!accessToken) {
    throw new Error('Could not get access token');
  }
  return accessToken.trim();
}

async function createRemoteRepo(repoName, octokit) {
  try {
    const { data } = await octokit.request('POST /user/repos', {
      name: repoName,
      gitignore_template: 'Node', //TODO: Allow user pass in template name
      auto_init: true,
    });

    return { url: data.html_url, cloneUrl: data.ssh_url, repoName: data.name };
  } catch (error) {
    throw new Error(`${error.status}::${error.response.data.message}`);
  }
}
async function cloneRepo(cloneUrl) {
  try {
    const { stdout } = await execa('git', ['clone', cloneUrl]);
  } catch (error) {
    throw new Error(error.message);
  }
}

const tasks = new Listr([
  {
    title: `${chalk.yellow('Fetching Access Token')}`,
    task: (ctx, task) => {
      const authToken = getAccessToken();
      const octokit = new Octokit({
        auth: authToken,
      });
      ctx.octokit = octokit;
    },
  },
  {
    title: `${chalk.yellow('Creating Remote repo')}`,
    task: (ctx, task) =>
      createRemoteRepo(ctx.repoName, ctx.octokit).then((data) => {
        task.title = `${chalk.green('Remote repo created at::')} ${chalk.blue(
          data.url
        )}`;
        ctx.cloneUrl = data.cloneUrl;
        ctx.name = data.repoName;
      }),
  },
  {
    title: `${chalk.yellow('Cloning Remote Repo')}`,
    task: (ctx) => cloneRepo(ctx.cloneUrl),
  },
]);
export function run(repoName) {
  if (!repoName) {
    console.log(chalk.red('Missing repo name'));
    process.exit(1);
  }
  tasks
    .run({ repoName })
    .then((ctx) => {
      console.log(
        `${chalk.green('SUCCESS::')} Project initiated at ${chalk.blue(
          join(ROOT_DIR, ctx.name)
        )}`
      );
    })
    .catch((err) => {
      console.error(chalk.red(err));
    });
}
