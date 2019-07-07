import * as React from "react"
import * as MSAL from "msal"

interface MsalContext {
    login: (request?: MSAL.AuthenticationParameters) => void | Promise<any>;
    logout: () => void;
    acquireToken: (request: MSAL.AuthenticationParameters) => Promise<MSAL.AuthResponse>;
}

type LoginMethod = "redirect" | "popup"


export const MsalContext = React.createContext<MsalContext>(undefined as any);

export function MsalProvider({ config, children, loginMethod, defaultLoginParameters }: { config: MSAL.Configuration, children: React.ReactNode, loginMethod: LoginMethod, defaultLoginParameters: MSAL.AuthenticationParameters }) {
    const app = React.useMemo(() => new MSAL.UserAgentApplication(config), [])

    async function login(request: MSAL.AuthenticationParameters) {
        if (loginMethod === "popup") {
            const response = await app.loginPopup({ ...defaultLoginParameters, ...request });
            return response;
        } else if (loginMethod === "redirect") {
            const response = await app.loginRedirect({ ...defaultLoginParameters, ...request });
            return response;
        }
    }

    return <MsalContext.Provider value={{
        login: login,
        logout: () => {
            app.logout()
        },
        acquireToken: async (request) => {
            try {
                const token = await app.acquireTokenSilent({
                    authority: app.authority,
                    ...request,
                });
                console.log("got token", token)
                return token;
            } catch (E) {
                if (E.errorCode === "user_login_error") {
                    await login(request);
                } else {
                    throw E
                }
                const token = await app.acquireTokenSilent({
                    authority: app.authority,
                    ...request,
                });
                return token;
            }
        }
    }}> {children}</MsalContext.Provider >
}
