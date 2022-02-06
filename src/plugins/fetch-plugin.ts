import * as esbuild from 'esbuild-wasm';
import localForage from 'localforage';
import axios from 'axios';

const fileCache = localForage.createInstance({
    name: 'file-cache',
    description: 'File cache for unpkg.com resources',
});

export const fetchPlugin = (inputCode: string) => {
    return {
        name: 'fetch-plugin',
        setup(build: esbuild.PluginBuild) {
            build.onLoad({ filter: /(^index\.js$)/ }, () => {
                return {
                    loader: 'jsx',
                    contents: inputCode,
                };
            });

            build.onLoad({ filter: /.*/ }, async (args: any) => {
                // check if we have a cached version of the file, if so, return it
                const cached = await fileCache.getItem<esbuild.OnLoadResult>(
                    args.path
                );
                if (cached) {
                    return cached;
                }
            });

            build.onLoad(
                {
                    filter: /.css$/,
                },
                async (args: any) => {
                    // if not, fetch it from unpkg.com and store it to cache
                    const { data, request } = await axios.get(args.path);
                    const escaped = CSS.escape(data);

                    const contents = `
                    const style = document.createElement('style');
                    style.innerText = '${escaped}';
                    document.head.appendChild(style);
                `;

                    const result: esbuild.OnLoadResult = {
                        loader: 'jsx',
                        contents,
                        resolveDir: new URL('./', request.responseURL).pathname,
                    };

                    await fileCache.setItem(args.path, result);

                    return result;
                }
            );

            build.onLoad({ filter: /.*/ }, async (args: any) => {
                // if not, fetch it from unpkg.com and store it to cache
                const { data, request } = await axios.get(args.path);

                const result: esbuild.OnLoadResult = {
                    loader: 'jsx',
                    contents: data,
                    resolveDir: new URL('./', request.responseURL).pathname,
                };

                await fileCache.setItem(args.path, result);

                return result;
            });
        },
    };
};
