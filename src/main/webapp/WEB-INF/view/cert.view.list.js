async function printButtonListCert(){
    const taskButton = $('#certList');
        let html = ''
        certs.forEach(cert => {
            let liHtml = `
            <div>
                <button onclick="signContent('${cert.certInfo.thumbprint}')">${cert.certInfo.subject.CN}</button>
            </div>
            `
            html += liHtml;
        })
    taskButton.html(html)
}
