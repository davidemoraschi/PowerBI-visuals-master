﻿/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved. 
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *   
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.common {
    import IStringResourceProvider = jsCommon.IStringResourceProvider;
    import Helpers = powerbitests.helpers;
    export declare var localizedStrings: jsCommon.IStringDictionary<string>;
    export declare var cultureInfo: string;

    /** 
     * interface of the service for translating the text into 
     * the desired localized string according to the user's browser language 
     */
    export interface ILocalizationService extends IStringResourceProvider {
        currentLanguageLocale: string;

        getOptional(id: string): string;
        ensureLocalization(action: () => void): void;
        format(id: string, ...args: any[]): string;
        formatValue(arg: any): string;
    }

    /** factory method to create the localization service. */
    export function createLocalizationService(promiseFactory?: IPromiseFactory, loader: localization.ILocalizationLoader = localization.loader): common.ILocalizationService {
        return new LocalizationService(loader, promiseFactory);
    }

    /** 
     * the translation service class which implements the common.ILocalizationService
     * For localized strings in view, use Localize directive to do the translation, apply watch on it and once loaded, deregister the watch.
     * For localized strings in controller, use rootScopt.emit to make a event call to only load the values once the strings are ready.
     * If the localized string ID doesn't exist, look for it in the default localized resources
     */
    class LocalizationService implements common.ILocalizationService {
        private loader: localization.ILocalizationLoader;
        private promiseFactory: IPromiseFactory;

        public constructor(loader: localization.ILocalizationLoader, promiseFactory?: IPromiseFactory) {
            this.promiseFactory = promiseFactory || createJQueryPromiseFactory();
            this.loader = loader;
        }

        public get currentLanguageLocale(): string {
            return this.loader.currentLanguageLocale;
        }

        /** 
         * localize the string according to the id 
         * @param {string} id - the lookup id in dictionary.
         */
        public get(id: string): string {
            return this.getImpl(id);
        }

        public getOptional(id: string): string {
            return this.getImpl(id, /*isOptional*/ true);
        }

        public ensureLocalization(action: () => void): IDeferred<{}> {
            var isLoadedDeferred = this.promiseFactory.defer<{}>();
            if (this.loader.isDataLoaded) {
                action();
                isLoadedDeferred.resolve({});
            }
            else if (this.loader.isDataLoading) {
                localization.promiseLoad.promise.then(() => {
                    action();
                    isLoadedDeferred.resolve({});
                }, () => {
                        debug.assertFail("LocalizationLoader failed loading data");
                        isLoadedDeferred.resolve({});
                    });
            } else {
                localization.promiseLoad = this.loader.load();
                localization.promiseLoad.promise.then(() => {
                    action();
                    isLoadedDeferred.resolve({});
                },
                    () => {
                        debug.assertFail("LocalizationLoader should not fail loading in any case");
                        isLoadedDeferred.resolve({});
                    });
            }
            return isLoadedDeferred;
        }

        public format(id: string, args: any[]): string {
            var result: string = this.get(id);
            var index: number = args.length;

            while (index--) {
                result = result.replace(new RegExp('\\{' + index + '\\}', 'gm'), this.formatValue(args[index]));
            }

            return result;
        }

        public formatValue(arg: any): string {
            if (arg == null) {
                return '';
            }
            else if (jsCommon.Utility.isString(arg)) {
                return arg;
            }
            else if (jsCommon.Utility.isNumber(arg)) {
                return (<number>arg).toLocaleString();
            }
            else if (jsCommon.Utility.isDate(arg)) {
                return (<Date>arg).toLocaleString();
            }
            else if (jsCommon.Utility.isObject(arg)) {
                if (arg['toLocaleString'] != null) {
                    return arg['toLocaleString']();
                }
                else {
                    return (<Object>arg).toString();
                }
            }
            else {
                return '';
            }
        }

        private getImpl(id: string, isOptional?: boolean): string {
            if (this.loader.isDataLoaded && !this.loader.isDefaultLanguage) {
                var localizationValue = this.loader.strings[id];
                if (!Helpers.isUndefined(localizationValue) && localizationValue !== null) {
                    return localizationValue;
                }
            }

            var defaultValue = powerbi.localization.defaultLocalizedStrings[id];
            if (Helpers.isUndefined(defaultValue) || defaultValue === null) {
                if (!isOptional) {
                    debug.assertFail('Localization Resource for ' + id + ' not found');
                }
            }

            return defaultValue;
        }
    }

    /** the localization service */
    export var localize: common.ILocalizationService;
}  