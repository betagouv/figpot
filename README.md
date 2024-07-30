# figpot

> [!IMPORTANT]
> The package is implemented and has been tested with a custom Penpot instance. To be widely used the Penpot SaaS must be patched... Be patient and follow the issue https://tree.taiga.io/project/penpot/us/8372 ⏱️🚀

Figma to Penpot converter and synchronizer, to not maintain multiple platforms.

## Information

### Figma & Penpot API clients

We do not use fixed schema version since their SaaS API evolve all the time. We rely on types check to detect any breaking change so we can adjust our logic.
