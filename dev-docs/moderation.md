# Moderation

ipfs-file-pin-service has an optional moderation feature that can be enabled with the use of environment variables. This feature allows operators of ipfs-file-pin-service to comply with moderation policies in their local jurisdiction, without forcing operators in other jurisdictions to operate by the same rules.

Moderation is achieved by loading an npm library that resolves to an array of CIDs. For example, the [psffpp-usa-moderation](https://github.com/Permissionless-Software-Foundation/psffpp-usa-moderation) is a library built for operating in the USA who receive DMCA take-down notices. Operators in the USA can run these moderation rules to comply with their jurisdiction, but operators outside that jurisdiction are not required to run it.

Below is an example for installing and running the psffpp-usa-moderation library, and enabling the moderation feature:

1. Install the library:
  - `npm install --save psffpp-usa-moderation`
2. Enable moderation with an environment variable at startup:
  - `export USE_MODERATION=true`
3. List the moderation libraries you want to use with an environment variable at startup:
  - `export MODERATION_LIBS=psffpp-usa-moderation`

If you have multiple libraries, separate them with a comma, like this:
  - `export MODERATION_LIBS=psffpp-usa-moderation,lib2,lib3`

All moderation libraries must resolve into an array of objects. Each object must have a `cid` property, like this:

```javascript
[
  {
    cid: 'bafkreibsgoiunnmli3sm7uec5vyqor4uf6savfzmmbokhgc5q7kcbnhkgq',
    filename: 'zebra2.jpg',
    reason: 'Test file',
    source: 'PSF'
  }
]
```

Once per hour, a Timer Controller will fire and compare the pins in the database to the list of moderated files. If a match is found, the file will be deleted and unpinned.