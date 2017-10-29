<?php

$filename = "outputs/" . $_POST["postid"].".txt";

$myfile = fopen($filename, "a+") or die("There was an error."); 
//fwrite($myfile, $_POST["firstname"]);
//fwrite($myfile, $_POST["lastname"]);
fwrite($myfile, $_POST["data"]);
fwrite($myfile, "\nEOF");
fclose($myfile); 

echo "Successfully received data.";
?>
