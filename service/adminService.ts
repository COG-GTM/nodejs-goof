// @TODO use this adminService file once Snyk Code for VSCode
// is able to navigate to cross-file paths in the vuln description 
/** 
import { Response } from 'express';

export function adminLoginSuccess(redirectPage: string | undefined, res: Response) {
    console.log({redirectPage})
    if (redirectPage) {
        return res.redirect(redirectPage)
    } else {
        return res.redirect('/admin')
    }
}
*/
export {};
