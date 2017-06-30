# Red Pitaya Multichannel Analyser
*A fresh Multichannel Analyser app for the Red Pitaya.*

![Image of MCA app](https://raw.githubusercontent.com/sefffal/redpitaya-multichannelanalyser/master/assets/mca.png)

This is a web application that can be run on the [Red Pitaya](http://redpitaya.com/) single board computer.
It supports the STEMLAB-10 and STEMLAB-14 running OS version 0.97+.

The FPGA program is taken from Pavel Demin's [red-pitaya-notes](http://pavel-demin.github.io/red-pitaya-notes/) repository so he deserves most of the credit.

The interface is responsive &mdash; try it on your phone!


## Installing

Access your Red Pitaya (replace rp-??? with the address on the sticker):
~~~bash
sh root@rp-???
~~~

Clone the reposity:
~~~bash
git clone https://github.com/sefffal/redpitaya-multichannelanalyser.git
~~~

Set the install directory of the Red Pitaya Ecosystem:
~~~bash
export INSTALL_DIR=/opt/redpitaya
~~~

Enter the directory, build, and install:
~~~bash
cd redpitaya-multichannelanalyser
make install
~~~

You should now have a new application on your Red Pitaya's home screen.
