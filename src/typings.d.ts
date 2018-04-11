

declare module 'ssl-utils'{
    function generateCertBuffer(prefix:string, 
                                keepTmp:boolean, 
                                certInfo:ICertInfo, 
                                caKeyPath:string, 
                                caCertPath:string, 
                                callbac:IResultCallback): void;


    interface ICertInfo{
        /**
         * subject: required child object with C (Country), ST (State), L (Locality), O (Organization), 
         * OU (Organizational Unit), CN (Common Name)
         */
        subject:ICertInfoSubject;

        /**
         * subjectaltname: optional string, comma-separated list of alt names for the certificate such as 
         * DNS:foo.domain.name, DNS:bar.domain.name, DNS:localhost, IP:127.0.0.1
         */
        subjectaltname:string
    }

    interface IResultCallback{
        (err:string, keyBuffer:string, certBuffer:string): void;
    }

    interface ICertInfoSubject{
        /**Country */
        C:string;
        /**State */
        ST:string;
        /**Locality */
        L:string;
        /**Organization */
        O:string;
        /**Organizational Unit */
        OU:string;
        /**Unit */
        CN:string;
    }
}












declare interface CsrGen{
    (domain:string,opts:ICsrGenOptions): void;
}


// outputDir, directory to create the keys in, defaults to os.tmpdir()
// read, bool, should the files get read for the callback to get the key and CSR
// destroy, bool, should the files be destroyed after they have been read
// company, defaults to the domain
// country, 2 letter country code, defaults to 'US'
// state, default: "California"
// city, default: "San Francisco"
// division, default: "Operations"
// email, typically required, empty by default
// password, default empty
// keyName, the filename of the private key to export. Defaults to domain+'.key'
// csrName, the filename of the csr to export. Defaults to domain+'.csr'







declare interface ICsrGenOptions{
    outputDir: string,
    read: boolean;
    destroy:boolean,
	company:string;
    email:string;
    country:string;
    state:string;
    city:string
    division:string
    password:string
    keyName:string
    csrName:string
}

