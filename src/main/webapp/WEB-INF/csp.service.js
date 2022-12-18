var vm = {};
var total = 1;
certs = undefined;

async function getAllCerts() {
    certs = await getCerts();
    printButtonListCert();
}

async function signContent(thumbprint) {
    total = document.getElementById('total').value
    var cert = certs.find(c => c.certInfo.thumbprint === thumbprint)
    await signPack(cert);
}

async function signPack(cert) {
    console.log("Начало подписания документа ")
    await sign(cert);
    console.log("Конец подписания документа ")
}

/**
 *  Подписание документа с использованием CSP сертификата
 *  @param params {{
 *      operator: String Код оператора
 *  }}
 *  @param cert:Object Сертификат, которым будем подписывать
 *  @return {Promise<{content: *}>} сигнатура контента
 */
async function sign(cert) {
    if (!vm.signProperties) {
        vm.signProperties = {
            signType: "CADES_BES",
            tsaAddress: "http://cryptopro.ru/tsp/"
        };
    }
    if (!cert) {
        throw "Не указан сертификат для доступа к оператору"
    }
    var signParams = {
        content: "0YTQstGE0YbQstGE0YbQstGE0YZoamJq",
        certificateInformation: cert.certInfo,
        type: vm.signProperties.signType,
        tsaAddress: vm.signProperties.tsaAddress
    };
    console.log("Подписываем контент ")
    try {
        for (let i = 0; i < total;) {
            i++
            let res = await _sign(signParams);
            console.log("Подписано " + i + " из " + total)
        }
    } catch (e) {
        console.error("При выполнении подписания произошла ошибка " + e.message + " " + e);
        throw {
            message: "csp.sign_error",
            description: (e.message || e)
        };
    }
}

async function _sign(params) {
    var signType;
    const oSigner = await createObject("CAdESCOM.CPSigner");
    console.log("Получение сертификата по его идентификатору" + params.certificateInformation.thumbprint)
    var certificate = await getCertificate(params.certificateInformation.thumbprint);
    console.log("установить сертификат" + certificate.certInfo.subject.CN)
    await setCertificate(oSigner, certificate.cert);
    console.log("Проверить установку сертификата")
    await setCheckCertificate(oSigner, true);
    console.log("Устанавливаем параметры сертификата")
    await setOptions(oSigner, cadesplugin.CAPICOM_CERTIFICATE_INCLUDE_CHAIN_EXCEPT_ROOT);
    console.log("signType присваиваем cadesplugin.CADESCOM_CADES_BES" + cadesplugin.CADESCOM_CADES_BES)
    signType = cadesplugin.CADESCOM_CADES_BES;
    console.log("Начало операции createObject(\"CAdESCOM.CadesSignedData\")")
    const oSignedDataObj = await createObject("CAdESCOM.CadesSignedData");
    console.log("Начало операции setContentEncoding()")
    await setContentEncoding(oSignedDataObj, cadesplugin.CADESCOM_BASE64_TO_BINARY);
    console.log("Начало операции setContent(oSignedDataObj, params.content)")
    await setContent(oSignedDataObj, params.content);

    try {
        console.log("Начало операции oSignedDataObj.SignCades()")
        let res = await oSignedDataObj.SignCades(oSigner, signType, true);
        const bool = await cadesplugin.ReleasePluginObjects()
        console.log("Удаление объектов плагина")
        return res;
    } catch (e) {
        console.error("При выполнении операции oSignedDataObj.SignCades() произошла ошибка" + e.message);
        const bool = await cadesplugin.ReleasePluginObjects()
        throw {
            message: "csp.sign_error",
            description: (e.message || e)
        };
    }
}

async function setContent(oSignedDataObj, content) {
    if (isAsync()) {
        return oSignedDataObj.propset_Content(content);
    } else {
        oSignedDataObj.Content = content;
        return null;
    }
}

async function setContentEncoding(oSignedDataObj, encoding) {
    if (isAsync()) {
        return oSignedDataObj.propset_ContentEncoding(encoding);
    } else {
        oSignedDataObj.ContentEncoding = encoding;
        return null;
    }
}

async function setOptions(signer, options) {
    if (isAsync()) {
        return signer.propset_Options(options);
    } else {
        signer.Options = options;
        return null;
    }
}

async function setCheckCertificate(signer, check) {
    if (isAsync()) {
        return signer.propset_CheckCertificate(check);
    } else {
        signer.CheckCertificate = check;
        return null;
    }
}

/**
 *  Получение сертификата по его идентификатору
 *  @param thumbprint - уникальный идентификатор сертификата
 *  @return искомый сертификат
 */
async function getCertificate(thumbprint) {
    var certs = await getCerts();
    for (var i = 0; i <= certs.length; i++) {
        if (certs[i].certInfo.thumbprint === thumbprint) {
            return certs[i];
        }
    }
}

async function setCertificate(signer, cert) {
    if (isAsync()) {
        return signer.propset_Certificate(cert);
    } else {
        signer.Certificate = cert;
        return null;
    }
}

/**
 *  Получение списка сертификатов из CSP
 *  @return {Promise<[]>} массив сертификатов
 */
async function getCerts() {
    var certs = [],
        cnt = 1;
    try {
        console.log("Получение списка сертификатов из CSP")
        const _storeObj = await createObject("CAPICOM.Store");
        await _storeObj.Open(
            cadesplugin.CAPICOM_CURRENT_USER_STORE,
            cadesplugin.CAPICOM_MY_STORE,
            cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        );
        certs = await _storeObj.Certificates;
        cnt = await certs.Count;
        await _storeObj.Close();
    } catch (e) {
        console.error("Ошибка открытия контейнера: " + e.message + " " + e)
        throw "Ошибка открытия контейнера: " + (e.message || e);
    }
    if (!cnt) {
        throw "Сертификаты не обнаружены";
    }
    const extract = async function (i) {
        const cert = await certs.Item(i);
        const certInfo = await _extractCertInfo(cert);
        if (!certInfo) {
            return null;
        }
        return {
            certInfo: certInfo,
            cert: cert
        };
    };
    var promiseArgs = [];
    for (var i = 1; i <= cnt; i++) {
        promiseArgs.push(extract(i));
    }
    return _.compact(await Promise.all(promiseArgs));
}

function isAsync() {
    return CSPPlugin().useAsync;
}

async function createObject(...args) {
    if (isAsync()) {
        return cadesplugin.CreateObjectAsync.apply(this, args);
    } else {
        return cadesplugin.CreateObject.apply(this, args);
    }
}

async function _extractCertInfo(cert) {
    var extractData = function (data) {
        var map = {};
        var arr = data.split(", ");
        for (var i = 0; i < arr.length; i++) {
            var prop = arr[i].split("=");
            map[prop[0]] = prop[1] || ""
        }
        return map;
    };
    try {
        return {
            thumbprint: await cert.Thumbprint,
            base64: await cert.Export(0),
            subject: extractData(await cert.SubjectName),
            container: 'CSP',
            issuer: extractData(await cert.IssuerName),
            start: new Date(await cert.ValidFromDate).toISOString(),
            expire: new Date(await cert.ValidToDate).toISOString(),
        };
    } catch (ex) {
        console.log(ex);
        return null;
    }
}
