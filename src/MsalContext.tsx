import * as React from "react"
import * as MSAL from "msal"

interface MsalContext {
    login: (request?: MSAL.AuthenticationParameters) => void | Promise<any>;
    logout: () => void;
    acquireToken: (request: MSAL.AuthenticationParameters) => Promise<MSAL.AuthResponse>;
    config: MSAL.Configuration;
    isLoggedIn: (scopes?: string[]) => Promise<boolean>;
    app: MSAL.UserAgentApplication,
    hasGivenConsent: (scopes:string[]) =>Promise<boolean>;
    giveConsent:(scopes:string[])=>Promise<void>;
}

type LoginMethod = "redirect" | "popup"

export const MsalContext = React.createContext<MsalContext>(undefined as any);

interface Props
{
  config: MSAL.Configuration
  children: React.ReactNode
  loginMethod: LoginMethod
  defaultLoginParameters: MSAL.AuthenticationParameters
}

export function MsalProvider({ config, children, loginMethod, defaultLoginParameters }: Props) {
    const app = React.useMemo(() => {
        const agent = new MSAL.UserAgentApplication(config)
        function authCallback(error:any, response:any) {
            if(error){
                console.error("msal redirect error")
                console.error(error)
                console.error(response)
            }
        }
        // (optional when using redirect methods) register redirect call back for Success or Error
        agent.handleRedirectCallback(authCallback);
        return agent
    }, [])

    async function login(request: MSAL.AuthenticationParameters) {
        const loginParameter = { ...defaultLoginParameters, ...request }
        if (loginMethod === "popup") {
            const response = await app.loginPopup(loginParameter);
            return response;
        } else if (loginMethod === "redirect") {
            const response = await app.loginRedirect(loginParameter);
            return response;
        }
    }

    const value = React.useMemo<MsalContext>(()=>({
        app,
        config,
        login: login,
        logout: () => {
            app.logout()
        },
        giveConsent: async (scopes)=>{
            if(loginMethod==="redirect") {
               app.acquireTokenRedirect({ scopes, prompt: "consent" })
            }else{
                await app.acquireTokenPopup({ scopes, prompt: "consent" })
            }
        },
        hasGivenConsent: async (scopes)=>{
            try {
                await app.acquireTokenSilent({scopes});
                return true
            } catch (E) {
                if(E.errorCode === "consent_required") {
                    return false
                } else {
                    console.error("error while checking for consent", E.errorCode)
                    throw E
                }
            }
        },
        acquireToken: async (request) => {
            try {
                const $request = {
                    // authority: app.authority,
                    ...request,
                }
                const token = await app.acquireTokenSilent($request);
                return token;
            } catch (E) {
                console.log(E)
                if (E.errorCode === "user_login_error") {
                    await login(request);
                }
                else if(E.errorCode === "consent_required"){
                    if (loginMethod === "popup") {
                        const response = await app.acquireTokenPopup(request);
                        return response;
                    } else if (loginMethod === "redirect") {
                        app.acquireTokenRedirect(request)
                    }
                }
                else if(E.errorCode ==="token_renewal_error") {
                    // await login(request);
                }
                else {
                    console.error("errorcode:", E.errorCode)
                    throw new Error("Could not acquire token silent " + E.toString())
                }
                const token = await app.acquireTokenSilent({
                    authority: app.authority,
                    ...request,
                });
                return token;
            }
        },
        isLoggedIn: async (scopes?: string[]) => {
            try {
                await app.acquireTokenSilent({ authority: app.authority, scopes: scopes? scopes: ["User.Read"] });
                return true
            } catch (E) {
                if(E.errorCode === "user_login_error")
                {
                    return false
                }
                return true
            }
        }
    }),[])

    return <MsalContext.Provider value={value}> {children}</MsalContext.Provider >
}
