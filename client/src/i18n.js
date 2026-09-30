import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import HttpApi from 'i18next-http-backend';

export const languages = [
    {name: 'English', code: 'en'},
    {name: 'Deutsch', code: 'de'},
    {name: 'Español', code: 'es'},
    {name: 'Français', code: 'fr'},
    {name: 'Italiano', code: 'it'},
]

i18n.use(initReactI18next).use(HttpApi).init({
    lng: navigator.language.split('-')[0],
    supportedLngs: languages.map(lang => lang.code),
    fallbackLng: 'en',
    backend: {
        loadPath: '/assets/locales/{{lng}}.json'
    },
});

export default i18n;