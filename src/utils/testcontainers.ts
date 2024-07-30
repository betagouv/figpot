import type { StartedGenericContainer } from 'testcontainers/dist/src/generic-container/started-generic-container';

export interface ContainerLogsOptions {
  enabled: boolean;
}

export async function bindContainerLogs(container: StartedGenericContainer, options: ContainerLogsOptions) {
  if (options.enabled) {
    const stream = await container.logs();
    stream
      .on('data', (line) => console.log(line))
      .on('err', (line) => console.error(line))
      .on('end', () => console.log('Stream closed'));
  }
}

export function getContainerNameSuffix(): string {
  return process.env.JEST_WORKER_ID !== undefined ? 'jest' : '';
}

export const defaultEnvironment = {
  DOCKER_COMPOSE_CONTAINER_NAME_SUFFIX: getContainerNameSuffix(),
};

export function formatContainerNameWithSuffix(containerNameBase: string) {
  return `${containerNameBase}_${getContainerNameSuffix()}`;
}
